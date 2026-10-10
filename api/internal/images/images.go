// Package images downloads Cockatrice card pictures on demand into a shared cache.
package images

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"mtg4fun/internal/catalog"
)

const maxImageSize = 20 * 1024 * 1024

const (
	imageAccept    = "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"
	imageUserAgent = "mtg4fun/1.0 (+https://github.com/rafacvs/mtg4fun)"
)

var ErrUnavailable = errors.New("imagem indisponível")

type Image struct {
	ContentType string
	Data        []byte
}

type Service struct {
	catalog *catalog.Catalog
	cache   string
	client  *http.Client
	locks   sync.Map
}

func New(cards *catalog.Catalog, cache string) *Service {
	return &Service{catalog: cards, cache: cache, client: &http.Client{Timeout: 15 * time.Second}}
}

func (s *Service) Get(name string) (Image, error) {
	card, ok := s.catalog.Lookup(name)
	if !ok || card.ImageURL == "" {
		return Image{}, ErrUnavailable
	}
	key := fmt.Sprintf("%x", sha256.Sum256([]byte(card.ImageURL)))
	lock, _ := s.locks.LoadOrStore(key, &sync.Mutex{})
	mutex := lock.(*sync.Mutex)
	mutex.Lock()
	defer mutex.Unlock()
	if image, err := readCached(s.cache, key); err == nil {
		return image, nil
	}
	return s.download(card.ImageURL, key)
}

func readCached(cache, key string) (Image, error) {
	paths, err := filepath.Glob(filepath.Join(cache, key+".*"))
	if err != nil || len(paths) != 1 {
		return Image{}, os.ErrNotExist
	}
	data, err := os.ReadFile(paths[0])
	if err != nil {
		return Image{}, err
	}
	contentType, ok := contentTypeForExtension(filepath.Ext(paths[0]))
	if !ok {
		return Image{}, os.ErrNotExist
	}
	return Image{ContentType: contentType, Data: data}, nil
}

func (s *Service) download(source, key string) (Image, error) {
	request, err := http.NewRequest(http.MethodGet, source, nil)
	if err != nil {
		return Image{}, fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	request.Header.Set("Accept", imageAccept)
	request.Header.Set("User-Agent", imageUserAgent)
	response, err := s.client.Do(request)
	if err != nil {
		return Image{}, fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return Image{}, fmt.Errorf("%w: fonte retornou %s", ErrUnavailable, response.Status)
	}
	contentType, extension, ok := supportedImageType(response.Header.Get("Content-Type"))
	if !ok {
		return Image{}, fmt.Errorf("%w: formato inválido", ErrUnavailable)
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, maxImageSize+1))
	if err != nil || len(data) > maxImageSize {
		return Image{}, fmt.Errorf("%w: arquivo inválido", ErrUnavailable)
	}
	if err := os.MkdirAll(s.cache, 0750); err != nil {
		return Image{}, err
	}
	temporary, err := os.CreateTemp(s.cache, ".image-*")
	if err != nil {
		return Image{}, err
	}
	temporaryPath := temporary.Name()
	defer os.Remove(temporaryPath)
	if err := temporary.Chmod(0600); err == nil {
		_, err = temporary.Write(data)
	}
	if err == nil {
		err = temporary.Sync()
	}
	if closeErr := temporary.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return Image{}, err
	}
	if err := os.Rename(temporaryPath, filepath.Join(s.cache, key+extension)); err != nil {
		return Image{}, err
	}
	return Image{ContentType: contentType, Data: data}, nil
}

func supportedImageType(value string) (string, string, bool) {
	contentType, _, err := mime.ParseMediaType(value)
	if err != nil {
		return "", "", false
	}
	switch strings.ToLower(contentType) {
	case "image/jpeg":
		return "image/jpeg", ".jpg", true
	case "image/png":
		return "image/png", ".png", true
	case "image/webp":
		return "image/webp", ".webp", true
	case "image/gif":
		return "image/gif", ".gif", true
	default:
		return "", "", false
	}
}

func contentTypeForExtension(extension string) (string, bool) {
	switch extension {
	case ".jpg":
		return "image/jpeg", true
	case ".png":
		return "image/png", true
	case ".webp":
		return "image/webp", true
	case ".gif":
		return "image/gif", true
	default:
		return "", false
	}
}
