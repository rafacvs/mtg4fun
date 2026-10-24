package rooms

import "encoding/json"

// Older snapshots stored the open window outside the library. Restore those
// cards once, then retain only their IDs as the consultation window.
func (p *playerState) UnmarshalJSON(data []byte) error {
	type snapshot playerState
	var decoded snapshot
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	*p = playerState(decoded)
	if len(p.Consulted)+len(p.Revealed) == 0 {
		return nil
	}
	cards := append(p.Consulted, p.Revealed...)
	existing := map[string]bool{}
	for _, card := range p.Library {
		existing[card.ID] = true
	}
	restored := []Card{}
	for _, card := range cards {
		if !existing[card.ID] {
			card.Zone = "library"
			restored = append(restored, card)
			existing[card.ID] = true
		}
		p.ConsultationIDs = append(p.ConsultationIDs, card.ID)
	}
	if p.ConsultationFrom == "bottom" {
		p.Library = append(p.Library, restored...)
	} else {
		p.Library = append(restored, p.Library...)
	}
	if p.ConsultationFrom == "" {
		p.ConsultationFrom = "all"
	}
	p.Consulted = nil
	p.Revealed = nil
	return nil
}
