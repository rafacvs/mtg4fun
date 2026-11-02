package integration_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"mime/multipart"
	"net/http"
	"testing"

	"mtg4fun/internal/playmats"
)

func uploadPlaymat(e *environment, cookie *http.Cookie, name string, data []byte) response {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, _ := writer.CreateFormFile("file", name)
	part.Write(data)
	writer.Close()
	return e.request("POST", "/api/playmats", body.String(), cookie, map[string]string{"Content-Type": writer.FormDataContentType()})
}

func TestPlaymatUploadPermissionsAndMatchPersistence(t *testing.T) {
	e := newEnvironment(t)
	for _, login := range []string{"owner", "other"} {
		e.mustCreate(login, login, "senha-dos-playmats")
	}
	e.start(false)
	owner := sessionCookie(t, e.login("owner", "senha-dos-playmats"))
	other := sessionCookie(t, e.login("other", "senha-dos-playmats"))
	requireStatus(t, e.request("GET", "/api/playmats", "", nil, nil), 401)
	var pngData, jpegData bytes.Buffer
	pixels := image.NewRGBA(image.Rect(0, 0, 8, 8))
	png.Encode(&pngData, pixels)
	jpeg.Encode(&jpegData, pixels, nil)
	requireStatus(t, uploadPlaymat(e, nil, "teste.png", pngData.Bytes()), 401)
	requireStatus(t, uploadPlaymat(e, owner, "teste.svg", []byte("<svg/>")), 400)
	requireStatus(t, uploadPlaymat(e, owner, "teste.jpg", pngData.Bytes()), 400)
	requireStatus(t, uploadPlaymat(e, owner, "teste.png", pngData.Bytes()[:30]), 400)
	requireStatus(t, uploadPlaymat(e, owner, "grande.png", make([]byte, 10*1024*1024+1)), 400)
	requireStatus(t, uploadPlaymat(e, owner, "teste.jpg", jpegData.Bytes()), 201)
	uploaded := uploadPlaymat(e, owner, "teste.png", pngData.Bytes())
	requireStatus(t, uploaded, 201)
	var result struct {
		Image struct {
			ID int64 `json:"id"`
		} `json:"image"`
	}
	if err := json.Unmarshal(uploaded.body, &result); err != nil {
		t.Fatal(err)
	}
	id := result.Image.ID
	imagePath := fmt.Sprintf("/api/playmats/%d/image", id)
	imageResult := e.request("GET", imagePath, "", owner, nil)
	requireStatus(t, imageResult, 200)
	if !bytes.Equal(imageResult.body, pngData.Bytes()) || imageResult.header.Get("Content-Type") != "image/png" {
		t.Fatal("imagem servida diferente do upload")
	}
	requireStatus(t, e.request("GET", imagePath, "", other, nil), 404)
	settings := playmats.Settings{Preset: "forest", ImageID: id, Fit: "contain", Zoom: 140, Dim: 35}
	raw, _ := json.Marshal(settings)
	requireStatus(t, e.request("PUT", "/api/playmats/preferences", string(raw), other, nil), 404)
	requireStatus(t, e.request("PUT", "/api/playmats/preferences", string(raw), owner, map[string]string{"Origin": "https://outro.example"}), 403)
	requireStatus(t, e.request("PUT", "/api/playmats/preferences", string(raw), owner, nil), 200)
	invalid := settings
	invalid.Zoom = 999
	invalidRaw, _ := json.Marshal(invalid)
	requireStatus(t, e.request("PUT", "/api/playmats/preferences", string(invalidRaw), owner, nil), 400)
	created := e.request("POST", "/api/rooms", roomJSON(), owner, nil)
	requireStatus(t, created, 201)
	roomID := decodeRoom(t, created).ID
	path := fmt.Sprintf("/api/rooms/%d", roomID)
	requireStatus(t, e.request("POST", path+"/participants", "{}", other, nil), 200)
	for _, cookie := range []*http.Cookie{owner, other} {
		deck := e.uploadDeck(cookie, []byte(`<cockatrice_deck><zone name="main"><card number="20" name="Island"/></zone></cockatrice_deck>`))
		requireStatus(t, deck, 201)
		var data struct {
			Deck struct {
				ID int64 `json:"id"`
			} `json:"deck"`
		}
		json.Unmarshal(deck.body, &data)
		requireStatus(t, e.request("PUT", path+"/participants/me/ready", fmt.Sprintf(`{"deckId":%d}`, data.Deck.ID), cookie, nil), 200)
	}
	requireStatus(t, e.request("POST", path+"/start", "{}", owner, nil), 201)
	readMats := func(cookie *http.Cookie) []playmats.Settings {
		t.Helper()
		response := e.request("GET", path+"/match", "", cookie, nil)
		requireStatus(t, response, 200)
		var data struct {
			Match struct {
				Players []struct {
					Playmat playmats.Settings `json:"playmat"`
				} `json:"players"`
			} `json:"match"`
		}
		if err := json.Unmarshal(response.body, &data); err != nil {
			t.Fatal(err)
		}
		mats := []playmats.Settings{}
		for _, p := range data.Match.Players {
			mats = append(mats, p.Playmat)
		}
		return mats
	}
	before := readMats(owner)
	if before[0] != settings || before[1].Random || before[1].ImageID != 0 {
		t.Fatalf("playmats incorretos: %+v", before)
	}
	if otherMats := readMats(other); otherMats[0] != before[0] || otherMats[1] != before[1] {
		t.Fatal("jogadores veem fundos diferentes")
	}
	requireStatus(t, e.request("GET", imagePath, "", other, nil), 200)
	changed := playmats.Default()
	changed.Fit = "stretch"
	changed.Zoom = 180
	raw, _ = json.Marshal(changed)
	requireStatus(t, e.request("PUT", "/api/playmats/preferences", string(raw), owner, nil), 200)
	requireStatus(t, e.request("DELETE", fmt.Sprintf("/api/playmats/%d", id), "", other, nil), 404)
	requireStatus(t, e.request("DELETE", fmt.Sprintf("/api/playmats/%d", id), "", owner, nil), 204)
	e.stop()
	e.start(false)
	after := readMats(other)
	if after[0] != before[0] || after[1] != before[1] {
		t.Fatal("reinício, alteração ou exclusão mudou o playmat da partida")
	}
	requireStatus(t, e.request("GET", imagePath, "", other, nil), 200)
	list := e.request("GET", "/api/playmats", "", owner, nil)
	requireStatus(t, list, 200)
	var library struct {
		Settings playmats.Settings `json:"settings"`
		Images   []struct {
			ID int64 `json:"id"`
		} `json:"images"`
	}
	json.Unmarshal(list.body, &library)
	if library.Settings != changed {
		t.Fatal("preferências não persistiram")
	}
	for _, img := range library.Images {
		if img.ID == id {
			t.Fatal("imagem excluída ainda listada")
		}
	}
}
