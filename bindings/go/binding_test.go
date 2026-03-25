package tree_sitter_agl_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_agl "github.com/lawliet-eng/agl-grammar/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_agl.Language())
	if language == nil {
		t.Errorf("Error loading AgentGraphLanguage grammar")
	}
}
