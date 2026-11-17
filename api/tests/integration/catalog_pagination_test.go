package integration_test

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDeckCatalogPagination(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("catalogo", "Catálogo", "senha-segura-de-teste")
	var xml strings.Builder
	xml.WriteString(`<cockatrice_carddatabase><cards>`)
	for index := 0; index < 123; index++ {
		fmt.Fprintf(&xml, `<card><name>Page card %03d</name><text>paging marker</text><prop><type>Artifact Creature</type><maintype>Artifact</maintype><cmc>%d</cmc><colors>G</colors><coloridentity>G</coloridentity></prop></card>`, index, index%5)
	}
	xml.WriteString(`</cards></cockatrice_carddatabase>`)
	e.cards = filepath.Join(t.TempDir(), "cards.xml")
	if err := os.WriteFile(e.cards, []byte(xml.String()), 0600); err != nil {
		t.Fatal(err)
	}
	e.start(false)
	cookie := sessionCookie(t, e.login("catalogo", "senha-segura-de-teste"))
	const path = "/api/decks/catalog"
	requireStatus(t, e.request("GET", path, "", nil, nil), 401)
	type page struct {
		Cards []struct {
			Name string `json:"name"`
		} `json:"cards"`
		Total   int  `json:"total"`
		Offset  int  `json:"offset"`
		Limit   int  `json:"limit"`
		HasMore bool `json:"hasMore"`
	}
	read := func(query string) page {
		t.Helper()
		response := e.request("GET", path+query, "", cookie, nil)
		requireStatus(t, response, 200)
		var result page
		if err := json.Unmarshal(response.body, &result); err != nil {
			t.Fatal(err)
		}
		return result
	}
	seen := map[string]bool{}
	for _, offset := range []int{0, 50, 100, 150} {
		result := read(fmt.Sprintf("?q=paging%%20marker&offset=%d", offset))
		expected := 50
		if offset == 100 {
			expected = 23
		}
		if offset == 150 {
			expected = 0
		}
		if len(result.Cards) != expected || result.Total != 123 || result.Offset != offset || result.Limit != 50 || result.HasMore != (offset < 100) {
			t.Fatalf("page at %d: %+v", offset, result)
		}
		for index, card := range result.Cards {
			if seen[card.Name] || card.Name != fmt.Sprintf("Page card %03d", offset+index) {
				t.Fatalf("duplicate or unstable page: %s", card.Name)
			}
			seen[card.Name] = true
		}
	}
	if len(seen) != 123 {
		t.Fatalf("missing cards: %d", len(seen))
	}
	filtered := read("?q=paging%20marker&type=Creature&color=G&cmc=3&limit=10")
	if len(filtered.Cards) != 10 || filtered.Total != 24 || !filtered.HasMore || filtered.Limit != 10 {
		t.Fatalf("filters and paging must compose: %+v", filtered)
	}
	for _, query := range []string{"?offset=-1", "?offset=no", "?offset=", "?limit=0", "?limit=51", "?limit=no", "?cmc=-1", "?color=NO"} {
		requireStatus(t, e.request("GET", path+query, "", cookie, nil), 400)
	}
}
