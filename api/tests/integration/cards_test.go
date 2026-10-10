package integration_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
)

func TestCardImageUsesSharedPersistentCache(t *testing.T) {
	var downloads atomic.Int32
	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("User-Agent") != "mtg4fun/1.0 (+https://github.com/rafacvs/mtg4fun)" || r.Header.Get("Accept") != "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" {
			http.Error(w, "cabeçalhos ausentes", http.StatusBadRequest)
			return
		}
		downloads.Add(1)
		w.Header().Set("Content-Type", "image/jpeg")
		_, _ = w.Write([]byte("imagem-controlada"))
	}))
	defer source.Close()

	e := newEnvironment(t)
	e.mustCreate("rafa", "Rafa", "senha-segura-de-teste")
	e.mustCreate("amigo", "Amigo", "senha-segura-de-teste")
	e.imageCache = filepath.Join(t.TempDir(), "imagens")
	fixture, err := os.ReadFile(e.tokens)
	if err != nil {
		t.Fatal(err)
	}
	e.tokens = filepath.Join(t.TempDir(), "tokens.xml")
	if err := os.WriteFile(e.tokens, []byte(strings.Replace(string(fixture), "https://example.invalid/soldier.png", source.URL+"/soldier.jpg", 1)), 0600); err != nil {
		t.Fatal(err)
	}
	e.start(false)
	first := sessionCookie(t, e.login("rafa", "senha-segura-de-teste"))
	second := sessionCookie(t, e.login("amigo", "senha-segura-de-teste"))
	deck := []byte(`<cockatrice_deck><zone name="main"><card number="1" name="Soldier Token"/></zone></cockatrice_deck>`)
	requireStatus(t, e.uploadDeck(first, deck), 201)
	requireStatus(t, e.uploadDeck(second, deck), 201)

	path := "/api/cards/image?name=Soldier+Token"
	requireStatus(t, e.request("GET", path, "", nil, nil), 401)
	firstImage := e.request("GET", path, "", first, nil)
	requireStatus(t, firstImage, 200)
	if firstImage.header.Get("Content-Type") != "image/jpeg" || !bytes.Equal(firstImage.body, []byte("imagem-controlada")) {
		t.Fatalf("imagem inesperada: tipo=%q corpo=%q", firstImage.header.Get("Content-Type"), firstImage.body)
	}
	requireStatus(t, e.request("GET", path, "", second, nil), 200)
	if downloads.Load() != 1 {
		t.Fatalf("cache não reutilizado entre usuários: %d downloads", downloads.Load())
	}
	e.stop()
	e.start(false)
	requireStatus(t, e.request("GET", path, "", first, nil), 200)
	if downloads.Load() != 1 {
		t.Fatalf("cache não sobreviveu ao reinício: %d downloads", downloads.Load())
	}
}

func TestCardImageReportsDownloadFailure(t *testing.T) {
	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "indisponível", http.StatusServiceUnavailable)
	}))
	defer source.Close()

	e := newEnvironment(t)
	e.mustCreate("rafa", "Rafa", "senha-segura-de-teste")
	e.imageCache = filepath.Join(t.TempDir(), "imagens")
	fixture, err := os.ReadFile(e.tokens)
	if err != nil {
		t.Fatal(err)
	}
	e.tokens = filepath.Join(t.TempDir(), "tokens.xml")
	if err := os.WriteFile(e.tokens, []byte(strings.Replace(string(fixture), "https://example.invalid/soldier.png", source.URL+"/soldier.jpg", 1)), 0600); err != nil {
		t.Fatal(err)
	}
	e.start(false)
	cookie := sessionCookie(t, e.login("rafa", "senha-segura-de-teste"))
	result := e.request("GET", "/api/cards/image?name=Soldier+Token", "", cookie, nil)
	requireStatus(t, result, 502)
	if !bytes.Contains(result.body, []byte("Não foi possível carregar a imagem desta carta.")) {
		t.Fatalf("falha incompreensível: %s", result.body)
	}
}
