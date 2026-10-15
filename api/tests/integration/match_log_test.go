package integration_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
)

type logEntryView struct {
	Kind  string `json:"kind"`
	From  string `json:"from"`
	To    string `json:"to"`
	Cards []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"cards"`
}

func readLogEntries(t *testing.T, result response) []logEntryView {
	t.Helper()
	requireStatus(t, result, 200)
	var body struct {
		Match struct {
			Log []logEntryView `json:"log"`
		} `json:"match"`
	}
	if err := json.Unmarshal(result.body, &body); err != nil {
		t.Fatal(err)
	}
	return body.Match.Log
}

func TestMatchLogCardReferencesRespectEventAndCurrentVisibility(t *testing.T) {
	e, cookies, path := prepareCreationMatch(t)
	number := 0
	action := func(fields string) response {
		number++
		result := e.request("POST", path+"/actions", fmt.Sprintf(`{"intentId":"%08x-5678-4000-8000-000000000000",%s}`, number, fields), cookies[0], nil)
		requireStatus(t, result, 200)
		return result
	}
	read := func(cookie *http.Cookie) response { return e.request("GET", path, "", cookie, nil) }
	drawn := action(`"kind":"draw","count":1`)
	card := creationPlayers(t, drawn)[0].Hand[0]
	ids := fmt.Sprintf(`"cardIds":[%q]`, card.ID)
	for _, entry := range readLogEntries(t, read(cookies[1])) {
		if len(entry.Cards) != 0 {
			t.Fatal("compra privada expôs referência")
		}
	}
	action(`"kind":"move","to":"graveyard",` + ids)
	for _, cookie := range cookies[:2] {
		entries := readLogEntries(t, read(cookie))
		refs := entries[len(entries)-1].Cards
		if len(refs) != 1 || refs[0].ID != card.ID || refs[0].Name != "Island" {
			t.Fatalf("movimento público sem carta identificada: %+v", entries)
		}
	}
	action(`"kind":"move","to":"hand",` + ids)
	for _, entry := range readLogEntries(t, read(cookies[1])) {
		if len(entry.Cards) > 0 {
			t.Fatal("histórico expôs identidade agora oculta na mão")
		}
	}
	ownerLog := readLogEntries(t, read(cookies[0]))
	if len(ownerLog[len(ownerLog)-1].Cards) != 1 {
		t.Fatal("dono não consegue consultar referência permitida na própria mão")
	}
	action(`"kind":"move","to":"library","libraryPlacement":"top",` + ids)
	for _, cookie := range cookies[:2] {
		for _, entry := range readLogEntries(t, read(cookie)) {
			if len(entry.Cards) > 0 {
				t.Fatal("referência de registro expôs conteúdo do grimório")
			}
		}
	}
	action(`"kind":"draw","count":1`)
	action(`"kind":"move","to":"battlefield",` + ids)
	entries := readLogEntries(t, read(cookies[1]))
	if len(entries[len(entries)-1].Cards) != 1 {
		t.Fatal("carta pública não pode ser consultada pelo registro")
	}
	for _, entry := range entries {
		if entry.From == "hand" && entry.To == "library" && len(entry.Cards) > 0 {
			t.Fatal("identidade atual revelou retroativamente uma ação privada")
		}
	}
	action(`"kind":"set_face_down","faceDown":true,` + ids)
	for _, entry := range readLogEntries(t, read(cookies[1])) {
		if len(entry.Cards) > 0 {
			t.Fatal("histórico identificou carta face para baixo")
		}
	}
	action(`"kind":"set_face_down","faceDown":false,` + ids)
	before := read(cookies[1])
	e.stop()
	e.start(false)
	if after := read(cookies[1]); !bytes.Equal(before.body, after.body) {
		t.Fatal("referências de cartas/log mudaram após reinício")
	}
	// Legacy events have no reliable card identifiers. Do not infer them from
	// counts or zone order; they must remain readable without invented links.
	e.sql("UPDATE " + e.db + ".match_events SET payload=JSON_REMOVE(payload, '$.cards')")
	for _, entry := range readLogEntries(t, read(cookies[1])) {
		if len(entry.Cards) > 0 {
			t.Fatal("registro antigo ganhou referência fabricada")
		}
	}
}
