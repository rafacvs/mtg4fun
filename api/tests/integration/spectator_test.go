package integration_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
)

func TestSpectatorReadsHandsAndCannotAct(t *testing.T) {
	e := newEnvironment(t)
	for _, name := range []string{"ana", "bia", "fora"} {
		e.mustCreate(name, name, "senha-da-sala")
	}
	e.start(false)
	ana := sessionCookie(t, e.login("ana", "senha-da-sala"))
	bia := sessionCookie(t, e.login("bia", "senha-da-sala"))
	fora := sessionCookie(t, e.login("fora", "senha-da-sala"))
	created := e.request("POST", "/api/rooms", roomJSON(), ana, nil)
	requireStatus(t, created, 201)
	path := fmt.Sprintf("/api/rooms/%d", decodeRoom(t, created).ID)
	requireStatus(t, e.request("POST", path+"/participants", "{}", bia, nil), 200)
	view := func(cookie *http.Cookie) response { return e.request("GET", path+"/match", "", cookie, nil) }

	// Antes do início não há o que assistir, e o jogo não pode ser ocupado por quem assiste.
	requireStatus(t, view(fora), 404)
	for _, cookie := range []*http.Cookie{ana, bia} {
		upload := e.uploadDeck(cookie, []byte(`<cockatrice_deck><zone name="main"><card number="20" name="Day Test"/></zone></cockatrice_deck>`))
		requireStatus(t, upload, 201)
		var deck struct {
			Deck struct {
				ID int64 `json:"id"`
			} `json:"deck"`
		}
		if err := json.Unmarshal(upload.body, &deck); err != nil {
			t.Fatal(err)
		}
		requireStatus(t, e.request("PUT", path+"/participants/me/ready", fmt.Sprintf(`{"deckId":%d}`, deck.Deck.ID), cookie, nil), 200)
	}
	requireStatus(t, e.request("POST", path+"/start", "{}", ana, nil), 201)
	confirmHands(t, e, path, ana, bia)

	number := 0
	action := func(cookie *http.Cookie, fields string) response {
		number++
		return e.request("POST", path+"/match/actions", fmt.Sprintf(`{"intentId":"%08x-4444-4000-8000-000000000000",%s}`, number, fields), cookie, nil)
	}

	watched := decodeHandReveal(t, view(fora))
	if len(watched.Players) != 2 {
		t.Fatalf("jogadores: %+v", watched.Players)
	}
	for _, player := range watched.Players {
		if len(player.Hand) != 7 {
			t.Fatalf("mão de %s: %+v", player.Name, player.Hand)
		}
		for _, card := range player.Hand {
			if card.Name != "Day Test" {
				t.Fatalf("carta da mão sem identidade: %+v", card)
			}
		}
	}

	// A mão aberta é só de quem assiste: entre jogadores ela continua privada.
	if hand := decodeHandReveal(t, view(ana)).player(t, "bia").Hand; len(hand) != 0 {
		t.Fatalf("jogador recebeu a mão do oponente: %+v", hand)
	}

	// Comprar acompanha a mão ao vivo, sem abrir a carta no registro público.
	draw := decodeHandReveal(t, action(ana, `"kind":"draw","count":1`))
	drawnID := draw.player(t, "ana").Hand[7].ID
	afterDraw := decodeHandReveal(t, view(fora))
	if len(afterDraw.player(t, "ana").Hand) != 8 {
		t.Fatalf("compra não chegou: %+v", afterDraw.player(t, "ana").Hand)
	}
	if last := afterDraw.Log[len(afterDraw.Log)-1]; last.Kind != "draw" || len(last.Cards) != 0 {
		t.Fatalf("registro de compra: %+v", last)
	}

	// Grimório e carta virada para baixo continuam fora do que se assiste.
	consulted := decodeHandReveal(t, action(bia, `"kind":"consult","consultFrom":"top","count":1`))
	if len(consulted.player(t, "bia").Hand) != 7 {
		t.Fatalf("consulta alterou a mão: %+v", consulted.player(t, "bia"))
	}
	var consultation struct {
		Match struct {
			Players []struct {
				Name      string `json:"name"`
				Consulted []struct {
					ID string `json:"id"`
				} `json:"consulted"`
			} `json:"players"`
		} `json:"match"`
	}
	biaView := view(bia)
	requireStatus(t, biaView, 200)
	if err := json.Unmarshal(biaView.body, &consultation); err != nil {
		t.Fatal(err)
	}
	libraryCard := ""
	for _, player := range consultation.Match.Players {
		if player.Name == "bia" && len(player.Consulted) == 1 {
			libraryCard = player.Consulted[0].ID
		}
	}
	if libraryCard == "" {
		t.Fatalf("consulta sem carta: %s", biaView.body)
	}
	requireStatus(t, action(bia, `"kind":"close","libraryPlacement":"top"`), 200)
	if body := view(fora).body; bytes.Contains(body, []byte(fmt.Sprintf("%q", libraryCard))) {
		t.Fatalf("carta do grimório chegou a quem assiste: %s", body)
	}
	requireStatus(t, action(ana, fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"battlefield"`, drawnID)), 200)
	requireStatus(t, action(ana, fmt.Sprintf(`"kind":"set_face_down","cardIds":[%q],"faceDown":true`, drawnID)), 200)
	var field struct {
		Match struct {
			Players []struct {
				Name        string `json:"name"`
				Battlefield []struct {
					ID   string `json:"id"`
					Name string `json:"name"`
				} `json:"battlefield"`
			} `json:"players"`
		} `json:"match"`
	}
	fieldView := view(fora)
	requireStatus(t, fieldView, 200)
	if err := json.Unmarshal(fieldView.body, &field); err != nil {
		t.Fatal(err)
	}
	seenFaceDown := false
	for _, player := range field.Match.Players {
		for _, card := range player.Battlefield {
			if card.ID == drawnID {
				seenFaceDown = card.Name == ""
			}
		}
	}
	if !seenFaceDown {
		t.Fatalf("carta virada para baixo sem ocultar a identidade: %s", fieldView.body)
	}

	// Nenhuma ação vale, e o estado não muda depois das tentativas.
	before := view(fora)
	for label, fields := range map[string]string{
		"comprar":   `"kind":"draw","count":1`,
		"moeda":     `"kind":"coin"`,
		"turno":     `"kind":"turn","direction":"next"`,
		"finalizar": `"kind":"finish"`,
		"mover":     fmt.Sprintf(`"kind":"move","cardIds":[%q],"to":"graveyard"`, drawnID),
	} {
		if result := action(fora, fields); result.status != 404 {
			t.Fatalf("%s: status %d; %s", label, result.status, result.body)
		}
	}
	if after := view(fora); !bytes.Equal(before.body, after.body) {
		t.Fatalf("tentativa de quem assiste mudou a partida:\n%s\n%s", before.body, after.body)
	}
	requireStatus(t, e.request("POST", path+"/participants", "{}", fora, nil), 409)

	// Encerrada, a partida volta a ser só dos jogadores.
	requireStatus(t, action(ana, `"kind":"finish"`), 200)
	requireStatus(t, view(fora), 404)
}
