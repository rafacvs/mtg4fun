#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Uso:
  scripts/worktree.sh create <nome> [base]
  scripts/worktree.sh list
  scripts/worktree.sh remove <nome>

Cria a branch work/<nome> em ../mtg4fun-worktrees/<nome>.
A base padrão é HEAD do checkout onde o comando é executado.
Se a branch já existir, omita a base para reabrir o trabalho.
Cada tarefa usa sua própria branch; jamais faça commits na master.
Faça conventional commits, publique a branch e abra PR sem merge para revisão.
A integração é responsabilidade do usuário.
Remove apenas o checkout; a branch e seus commits são preservados.
EOF
}

fail() {
  printf 'Erro: %s\n' "$*" >&2
  exit 1
}

action=${1:-help}
case "$action" in
  help|-h|--help) usage; exit 0 ;;
  create) [[ $# -ge 2 && $# -le 3 ]] || { usage >&2; exit 1; } ;;
  remove) [[ $# -eq 2 ]] || { usage >&2; exit 1; } ;;
  list) [[ $# -eq 1 ]] || { usage >&2; exit 1; } ;;
  *) usage >&2; exit 1 ;;
esac

# O primeiro registro é o checkout principal, inclusive em uma worktree.
worktrees=$(git worktree list --porcelain)
first_line=${worktrees%%$'\n'*}
[[ "$first_line" == 'worktree '* ]] || fail 'Checkout principal não encontrado.'
main_root=${first_line#worktree }
worktree_root="$(dirname "$main_root")/$(basename "$main_root")-worktrees"

if [[ "$action" == list ]]; then
  git worktree list
  exit 0
fi

name=$2
[[ "$name" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]*$ ]] ||
  fail 'Use um nome com letras, números, hífens e underscores, começando com letra ou número.'
branch="work/$name"
target="$worktree_root/$name"

case "$action" in
  create)
    [[ ! -e "$target" && ! -L "$target" ]] || fail "O caminho já existe: $target"
    if git show-ref --verify --quiet "refs/heads/$branch"; then
      [[ $# -eq 2 ]] || fail 'A branch já existe; omita a base para reabri-la.'
      git worktree add "$target" "$branch"
    else
      base=${3:-HEAD}
      git rev-parse --verify --end-of-options "${base}^{commit}" >/dev/null
      git worktree add -b "$branch" "$target" "$base"
    fi
    printf '\nWorktree pronta: %s\nBranch: %s\n' "$target" "$branch"
    ;;
  remove)
    # Sem --force: o Git protege alterações locais e worktrees bloqueadas.
    git worktree remove "$target"
    printf 'Checkout removido. Branch preservada: %s\n' "$branch"
    ;;
esac
