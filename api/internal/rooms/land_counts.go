package rooms

import "strings"

// Count only the selected face, and only when its identity is visible to the viewer.
func (s *Service) isLand(name string, faces []string, faceIndex int) bool {
	if name == "" || s.catalog == nil {
		return false
	}
	if len(faces) > 0 && faceIndex >= 0 && faceIndex < len(faces) {
		name = faces[faceIndex]
	}
	entry, ok := s.catalog.Lookup(name)
	if !ok {
		return false
	}
	// Subtypes cannot turn a non-land card into a Land.
	types := strings.Split(strings.Split(entry.Type, "—")[0], " - ")[0]
	for _, word := range strings.Fields(types) {
		if strings.EqualFold(word, "Land") {
			return true
		}
	}
	return false
}
