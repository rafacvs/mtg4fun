package rooms

func validManaColor(color string) bool {
	switch color {
	case "white", "blue", "black", "red", "green", "colorless":
		return true
	}
	return false
}

func basicMana(card Card) string {
	name := card.Name
	if len(card.Faces) > 0 && card.FaceIndex >= 0 && card.FaceIndex < len(card.Faces) {
		name = card.Faces[card.FaceIndex]
	}
	switch name {
	case "Plains", "Snow-Covered Plains":
		return "white"
	case "Island", "Snow-Covered Island":
		return "blue"
	case "Swamp", "Snow-Covered Swamp":
		return "black"
	case "Mountain", "Snow-Covered Mountain":
		return "red"
	case "Forest", "Snow-Covered Forest":
		return "green"
	case "Wastes":
		return "colorless"
	}
	return ""
}
