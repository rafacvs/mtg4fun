package rooms

func transferControl(m *matchState, p *playerState, input matchAction) (actionLogPayload, error) {
	if input.ControllerID == p.UserID {
		return actionLogPayload{}, errInvalidCardState
	}
	target := playerByID(m, input.ControllerID)
	if target == nil {
		return actionLogPayload{}, errInvalidCardState
	}
	for i := range p.Battlefield {
		card := p.Battlefield[i]
		if card.ID != input.CardID {
			continue
		}
		if card.ControllerID != p.UserID {
			return actionLogPayload{}, errNotController
		}
		x, row := firstFreeCell(target.Battlefield)
		if x > 20000 || row > 2000 {
			return actionLogPayload{}, errInvalidPosition
		}
		p.Battlefield = append(p.Battlefield[:i], p.Battlefield[i+1:]...)
		m.NextStackOrder++
		card.ControllerID = target.UserID
		card.PositionX = x
		card.Row = row
		card.StackOrder = m.NextStackOrder
		target.Battlefield = append(target.Battlefield, card)
		return actionLogPayload{Kind: "transfer_control", Result: target.Name}, nil
	}
	return actionLogPayload{}, errCardNotFound
}
