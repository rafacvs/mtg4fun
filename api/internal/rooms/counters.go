package rooms

import (
	"errors"
	"fmt"
)

const maxCounterValue int64 = 9007199254740991

var errCounterPermission = errors.New("Você só pode alterar seus contadores e as cartas autorizadas.")
var errCounterRange = errors.New("O valor do contador excede o intervalo permitido.")

func validColor(color string) bool {
	switch color {
	case "red", "yellow", "green", "blue", "purple":
		return true
	default:
		return false
	}
}

func validCounterInput(input matchAction) bool {
	if input.Value < -maxCounterValue || input.Value > maxCounterValue {
		return false
	}
	if input.Operation != "set" && input.Operation != "increment" {
		return false
	}
	player := input.Target == "player" && input.PlayerID > 0 && input.CardID == ""
	card := input.Target == "card" && input.CardID != "" && input.PlayerID == 0
	switch input.Subject {
	case "life":
		return player
	case "power", "toughness":
		return card
	case "marker":
		return (player || card) && validColor(input.Color)
	default:
		return false
	}
}

func counterValue(current int64, input matchAction) (int64, error) {
	value := input.Value
	if input.Operation == "increment" {
		value += current
	}
	if value < -maxCounterValue || value > maxCounterValue {
		return 0, errCounterRange
	}
	return value, nil
}

func markerSlot(counts *colorCounts, color string) *int64 {
	switch color {
	case "red":
		return &counts.Red
	case "yellow":
		return &counts.Yellow
	case "green":
		return &counts.Green
	case "blue":
		return &counts.Blue
	case "purple":
		return &counts.Purple
	default:
		return nil
	}
}

func colorLabel(color string) string {
	switch color {
	case "red":
		return "vermelho"
	case "yellow":
		return "amarelo"
	case "green":
		return "verde"
	case "blue":
		return "azul"
	case "purple":
		return "roxo"
	default:
		return color
	}
}

func applyMarker(counts *colorCounts, input matchAction) (int64, error) {
	slot := markerSlot(counts, input.Color)
	if slot == nil {
		return 0, errCounterRange
	}
	value, err := counterValue(*slot, input)
	if err != nil {
		return 0, err
	}
	*slot = value
	return value, nil
}

func changeCounter(m *matchState, actor *playerState, input matchAction) (actionLogPayload, error) {
	if input.Target == "player" {
		if input.PlayerID != actor.UserID {
			return actionLogPayload{}, errCounterPermission
		}
		switch input.Subject {
		case "life":
			value, err := counterValue(int64(actor.Life), input)
			if err != nil {
				return actionLogPayload{}, err
			}
			actor.Life = int(value)
			return actionLogPayload{Kind: "counter", Result: fmt.Sprintf("vida = %d", value)}, nil
		case "marker":
			value, err := applyMarker(&actor.Markers, input)
			if err != nil {
				return actionLogPayload{}, err
			}
			return actionLogPayload{Kind: "counter", Result: fmt.Sprintf("marcador %s = %d", colorLabel(input.Color), value)}, nil
		default:
			return actionLogPayload{}, errCounterPermission
		}
	}
	for i := range m.Players {
		for _, name := range []string{"hand", "battlefield", "graveyard", "exile", "command", "consulted", "revealed"} {
			cards := zone(&m.Players[i], name)
			for j := range *cards {
				card := &(*cards)[j]
				if card.ID != input.CardID {
					continue
				}
				permitted := card.OwnerID == actor.UserID
				if name == "battlefield" {
					permitted = card.ControllerID == actor.UserID
				}
				if !permitted {
					return actionLogPayload{}, errCounterPermission
				}
				var err error
				switch input.Subject {
				case "power":
					var value int64
					value, err = counterValue(card.Power, input)
					if err == nil {
						card.Power = value
					}
				case "toughness":
					var value int64
					value, err = counterValue(card.Toughness, input)
					if err == nil {
						card.Toughness = value
					}
				case "marker":
					_, err = applyMarker(&card.Markers, input)
				default:
					err = errCounterPermission
				}
				return actionLogPayload{Kind: "counter", Result: "contador de carta alterado"}, err
			}
		}
	}
	return actionLogPayload{}, errCardNotFound
}

// changeCounters runs within the match transaction; any failure discards the snapshot.
func changeCounters(m *matchState, actor *playerState, input matchAction) (actionLogPayload, error) {
	seen := make(map[string]bool, len(input.CardIDs))
	for _, id := range input.CardIDs {
		if id == "" || seen[id] {
			return actionLogPayload{}, errInvalidCardState
		}
		seen[id] = true
		one := input
		one.CardID = id
		one.Target = "card"
		if input.Subject == "pair" {
			one.Subject = "power"
			if _, err := changeCounter(m, actor, one); err != nil {
				return actionLogPayload{}, err
			}
			one.Subject = "toughness"
			one.Value = input.SecondValue
		}
		if _, err := changeCounter(m, actor, one); err != nil {
			return actionLogPayload{}, err
		}
	}
	return actionLogPayload{Kind: "counter", Result: "contador de carta alterado"}, nil
}
