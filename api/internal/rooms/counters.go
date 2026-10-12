package rooms

import (
	"errors"
	"fmt"
	"unicode"
	"unicode/utf8"
)

const maxCounterValue int64 = 9007199254740991

var errCounterPermission = errors.New("Você só pode alterar seus contadores e as cartas autorizadas.")
var errCounterRange = errors.New("O valor do contador excede o intervalo permitido.")

func validCounterInput(input matchAction) bool {
	if input.CounterName == "" || utf8.RuneCountInString(input.CounterName) > 80 || input.Value < -maxCounterValue || input.Value > maxCounterValue {
		return false
	}
	for _, r := range input.CounterName {
		if unicode.IsControl(r) {
			return false
		}
	}
	if input.Operation != "set" && input.Operation != "increment" {
		return false
	}
	return input.Target == "player" && input.PlayerID > 0 && input.CardID == "" || input.Target == "card" && input.CardID != "" && input.PlayerID == 0
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

func updateNamedCounter(counters *map[string]int64, input matchAction) (int64, error) {
	value, err := counterValue((*counters)[input.CounterName], input)
	if err != nil {
		return 0, err
	}
	if *counters == nil {
		*counters = map[string]int64{}
	}
	(*counters)[input.CounterName] = value
	return value, nil
}

func changeCounter(m *matchState, actor *playerState, input matchAction) (actionLogPayload, error) {
	if input.Target == "player" {
		if input.PlayerID != actor.UserID {
			return actionLogPayload{}, errCounterPermission
		}
		var value int64
		var err error
		if input.CounterName == "Vida" {
			value, err = counterValue(int64(actor.Life), input)
			if err == nil {
				actor.Life = int(value)
			}
		} else {
			value, err = updateNamedCounter(&actor.Counters, input)
		}
		return actionLogPayload{Kind: "counter", Result: fmt.Sprintf("%s = %d", input.CounterName, value)}, err
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
				_, err := updateNamedCounter(&card.Counters, input)
				return actionLogPayload{Kind: "counter", Result: "contador de carta alterado"}, err
			}
		}
	}
	return actionLogPayload{}, errCardNotFound
}
