package playmats

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"unicode/utf8"

	_ "golang.org/x/image/webp"
	"mtg4fun/internal/auth"
	"mtg4fun/internal/httpserver"
)

const maxImage = 10 * 1024 * 1024

type imageInfo struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}
type service struct{ db *sql.DB }
type ownerKey struct{}

func Handler(db *sql.DB, users *auth.Service) http.Handler {
	s := service{db}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/playmats", s.list)
	mux.HandleFunc("POST /api/playmats", s.upload)
	mux.HandleFunc("PUT /api/playmats/preferences", s.preferences)
	mux.HandleFunc("GET /api/playmats/{id}/image", s.image)
	mux.HandleFunc("DELETE /api/playmats/{id}", s.remove)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, _, err := users.CurrentUser(r)
		if errors.Is(err, sql.ErrNoRows) {
			httpserver.WriteError(w, 401, "Entre para continuar.")
			return
		}
		if err != nil {
			httpserver.InternalError(w, err)
			return
		}
		// The authenticated identity is passed through the handler closure, never the request body.
		mux.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ownerKey{}, user.ID)))
	})
}
func owner(r *http.Request) int64   { return r.Context().Value(ownerKey{}).(int64) }
func imageID(r *http.Request) int64 { id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64); return id }

func (s service) list(w http.ResponseWriter, r *http.Request) {
	settings, err := Load(r.Context(), s.db, owner(r))
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	rows, err := s.db.QueryContext(r.Context(), "SELECT id,name FROM playmat_images WHERE user_id=? AND deleted=FALSE ORDER BY id DESC", owner(r))
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	defer rows.Close()
	images := []imageInfo{}
	for rows.Next() {
		var img imageInfo
		if err = rows.Scan(&img.ID, &img.Name); err != nil {
			httpserver.InternalError(w, err)
			return
		}
		images = append(images, img)
	}
	if err = rows.Err(); err != nil {
		httpserver.InternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, 200, map[string]any{"images": images, "settings": settings})
}
func (s service) upload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxImage+65536)
	if err := r.ParseMultipartForm(maxImage + 65536); err != nil {
		httpserver.WriteError(w, 400, "Envie JPG, PNG ou WEBP de até 10 MB.")
		return
	}
	defer r.MultipartForm.RemoveAll()
	if len(r.MultipartForm.File) != 1 || len(r.MultipartForm.File["file"]) != 1 || len(r.MultipartForm.Value) != 0 {
		httpserver.WriteError(w, 400, "Envie uma imagem no campo file.")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		httpserver.WriteError(w, 400, "Selecione uma imagem.")
		return
	}
	defer file.Close()
	content, err := io.ReadAll(io.LimitReader(file, maxImage+1))
	if err != nil || len(content) > maxImage {
		httpserver.WriteError(w, 400, "Envie uma imagem de até 10 MB.")
		return
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(content))
	media := map[string]string{"jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}[format]
	ext := strings.ToLower(filepath.Ext(header.Filename))
	extensions := map[string]string{".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
	if err != nil || media == "" || extensions[ext] != media || config.Width <= 0 || config.Height <= 0 || int64(config.Width)*int64(config.Height) > 40_000_000 {
		httpserver.WriteError(w, 400, "Imagem inválida. Use JPG, PNG ou WEBP com até 40 milhões de pixels.")
		return
	}
	// Decode the whole file as well, so truncated images cannot become saved playmats.
	if _, _, err = image.Decode(bytes.NewReader(content)); err != nil {
		httpserver.WriteError(w, 400, "Não foi possível ler a imagem.")
		return
	}
	name := filepath.Base(strings.ReplaceAll(header.Filename, "\\", "/"))
	if !utf8.ValidString(name) || utf8.RuneCountInString(name) > 255 {
		httpserver.WriteError(w, 400, "Nome da imagem muito longo ou inválido.")
		return
	}
	result, err := s.db.ExecContext(r.Context(), "INSERT INTO playmat_images(user_id,name,media_type,content) VALUES(?,?,?,?)", owner(r), name, media, content)
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	id, err := result.LastInsertId()
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, 201, map[string]any{"image": imageInfo{id, name}})
}
func (s service) preferences(w http.ResponseWriter, r *http.Request) {
	var settings Settings
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
	dec.DisallowUnknownFields()
	if strings.Split(r.Header.Get("Content-Type"), ";")[0] != "application/json" || dec.Decode(&settings) != nil || dec.Decode(&struct{}{}) != io.EOF || !settings.valid() {
		httpserver.WriteError(w, 400, "Ajustes inválidos.")
		return
	}
	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	defer tx.Rollback()
	if settings.ImageID != 0 {
		var id int64
		err = tx.QueryRowContext(r.Context(), "SELECT id FROM playmat_images WHERE id=? AND user_id=? AND deleted=FALSE FOR UPDATE", settings.ImageID, owner(r)).Scan(&id)
		if errors.Is(err, sql.ErrNoRows) {
			httpserver.WriteError(w, 404, "Imagem não encontrada.")
			return
		}
		if err != nil {
			httpserver.InternalError(w, err)
			return
		}
	}
	raw, _ := json.Marshal(settings)
	_, err = tx.ExecContext(r.Context(), "INSERT INTO playmat_preferences(user_id,settings) VALUES(?,?) ON DUPLICATE KEY UPDATE settings=VALUES(settings)", owner(r), raw)
	if err == nil {
		err = tx.Commit()
	}
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	httpserver.WriteJSON(w, 200, map[string]any{"settings": settings})
}
func (s service) image(w http.ResponseWriter, r *http.Request) {
	var media string
	var content []byte
	// Uploaded images remain private until used in a match. Spectators can see match backgrounds.
	err := s.db.QueryRowContext(r.Context(), `SELECT media_type,content FROM playmat_images WHERE id=? AND ((user_id=? AND deleted=FALSE) OR EXISTS (SELECT 1 FROM matches WHERE JSON_CONTAINS(JSON_EXTRACT(snapshot,'$.players[*].playmat.imageId'),CAST(? AS JSON))))`, imageID(r), owner(r), strconv.FormatInt(imageID(r), 10)).Scan(&media, &content)
	if errors.Is(err, sql.ErrNoRows) {
		httpserver.WriteError(w, 404, "Imagem não encontrada.")
		return
	}
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	w.Header().Set("Content-Type", media)
	w.Header().Set("Content-Length", strconv.Itoa(len(content)))
	w.Header().Set("Content-Disposition", "inline")
	_, _ = w.Write(content)
}
func (s service) remove(w http.ResponseWriter, r *http.Request) {
	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	defer tx.Rollback()
	var id int64
	err = tx.QueryRowContext(r.Context(), "SELECT id FROM playmat_images WHERE id=? AND user_id=? AND deleted=FALSE FOR UPDATE", imageID(r), owner(r)).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		httpserver.WriteError(w, 404, "Imagem não encontrada.")
		return
	}
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	// Preserve bytes referenced by durable matches, even after removal from the personal library.
	if _, err = tx.ExecContext(r.Context(), "UPDATE playmat_images SET deleted=TRUE WHERE id=?", id); err != nil {
		httpserver.InternalError(w, err)
		return
	}
	settings, err := Load(r.Context(), tx, owner(r))
	if err != nil {
		httpserver.InternalError(w, err)
		return
	}
	if settings.ImageID == id {
		settings.ImageID = 0
		settings.Random = true
		raw, _ := json.Marshal(settings)
		if _, err = tx.ExecContext(r.Context(), "UPDATE playmat_preferences SET settings=? WHERE user_id=?", raw, owner(r)); err != nil {
			httpserver.InternalError(w, err)
			return
		}
	}
	if err = tx.Commit(); err != nil {
		httpserver.InternalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
