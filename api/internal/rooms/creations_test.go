package rooms

import "testing"

func TestFirstCreatedTokenCellStartsEmptyThenReusesEquivalentStack(t *testing.T) {
	soldier := Card{Name: "Soldado", InstanceKind: "token"}
	cards := []Card{
		{Name: "Ilha", PositionX: 0, Row: 0, StackOrder: 1},
		{Name: "Floresta", PositionX: 2, Row: 0, StackOrder: 2},
	}

	if column, row := firstCreatedTokenCell(cards, soldier); column != 1 || row != 0 {
		t.Fatalf("primeira ficha = (%d, %d), esperado célula vazia (1, 0)", column, row)
	}
	cards = append(cards, Card{Name: "Soldado", InstanceKind: "token", PositionX: 1, Row: 0, StackOrder: 3})
	if column, row := firstCreatedTokenCell(cards, soldier); column != 1 || row != 0 {
		t.Fatalf("ficha equivalente = (%d, %d), esperado pilha (1, 0)", column, row)
	}
	cards = append(cards,
		Card{Name: "Soldado", InstanceKind: "token", PositionX: 1, Row: 0, StackOrder: 4},
		Card{Name: "Soldado", InstanceKind: "token", PositionX: 1, Row: 0, StackOrder: 5},
	)
	if column, row := firstCreatedTokenCell(cards, soldier); column != 3 || row != 0 {
		t.Fatalf("nova pilha = (%d, %d), esperado célula vazia (3, 0)", column, row)
	}
}

func TestFirstCreatedTokenCellDoesNotReuseMixedStack(t *testing.T) {
	soldier := Card{Name: "Soldado", InstanceKind: "token"}
	cards := []Card{
		{Name: "Soldado", InstanceKind: "token", PositionX: 0, Row: 0, StackOrder: 1},
		{Name: "Aura", PositionX: 0, Row: 0, StackOrder: 2},
	}
	if column, row := firstCreatedTokenCell(cards, soldier); column != 1 || row != 0 {
		t.Fatalf("pilha misturada foi reutilizada: (%d, %d)", column, row)
	}
}
