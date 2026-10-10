// Package httpserver composes HTTP handlers and serves the compiled frontend.
package httpserver

import "net/http"

// NewHandler accepts the application's API handler without importing features.
func NewHandler(api http.Handler, webDir string, secure bool) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("/api/", api)
	if webDir == "" {
		return protect(mux, secure)
	}
	files := http.FileServer(http.Dir(webDir))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.Header().Set("Allow", "GET, HEAD")
			WriteError(w, http.StatusMethodNotAllowed, "Método não permitido.")
			return
		}
		files.ServeHTTP(w, r)
	})
	return protect(mux, secure)
}
