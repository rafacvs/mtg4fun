package rooms

// targetArrow identifies public battlefield endpoints without exposing card data.
type targetArrow struct {
	OwnerID        int64  `json:"ownerId"`
	SourceCardID   string `json:"sourceCardId"`
	TargetCardID   string `json:"targetCardId,omitempty"`
	TargetPlayerID int64  `json:"targetPlayerId,omitempty"`
}

// validTargetArrow accepts only cards currently on a battlefield and players
// in the match; private zones must never become shared arrow endpoints.
func validTargetArrow(m *matchState, arrow targetArrow) bool {
	if playerByID(m, arrow.OwnerID) == nil || arrow.SourceCardID == "" ||
		(arrow.TargetCardID == "") == (arrow.TargetPlayerID == 0) {
		return false
	}
	source, target := false, arrow.TargetCardID == "" && playerByID(m, arrow.TargetPlayerID) != nil
	for _, player := range m.Players {
		for _, card := range player.Battlefield {
			source = source || card.ID == arrow.SourceCardID
			target = target || arrow.TargetCardID != "" && card.ID == arrow.TargetCardID
		}
	}
	return source && target
}

func visibleTargetArrows(m *matchState) []targetArrow {
	result := make([]targetArrow, 0, len(m.Arrows))
	for _, arrow := range m.Arrows {
		if validTargetArrow(m, arrow) {
			result = append(result, arrow)
		}
	}
	return result
}
