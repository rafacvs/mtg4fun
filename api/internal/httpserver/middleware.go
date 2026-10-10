package httpserver

import (
	"net/http"
	"strings"
)

func protect(next http.Handler, secure bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "same-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-store")
			if r.Method != "GET" && r.Method != "HEAD" {
				scheme := "http"
				if secure || r.TLS != nil {
					scheme = "https"
				}
				origin := r.Header.Get("Origin")
				if r.Header.Get("Sec-Fetch-Site") == "cross-site" || (origin != "" && origin != scheme+"://"+r.Host) {
					WriteError(w, http.StatusForbidden, "Origem não permitida.")
					return
				}
			}
		}
		next.ServeHTTP(w, r)
	})
}
