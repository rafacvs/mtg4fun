package httpserver

import (
	"encoding/json"
	"log"
	"net/http"
)

func WriteJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func WriteError(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, map[string]string{"error": message})
}

func InternalError(w http.ResponseWriter, err error) {
	log.Printf("falha de armazenamento: %v", err)
	WriteError(w, http.StatusInternalServerError, "Não foi possível concluir. Tente novamente.")
}
