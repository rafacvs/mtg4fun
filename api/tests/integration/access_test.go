package integration_test

import (
	"bytes"
	"net/http"
	"regexp"
	"strings"
	"testing"
	"time"
)

func TestAPIStartsWithoutFrontendBuild(t *testing.T) {
	e := newEnvironment(t)
	e.web = ""
	e.start(false)
	requireStatus(t, e.request("GET", "/api/session", "", nil, nil), 401)
	requireStatus(t, e.request("GET", "/", "", nil, nil), 404)
}

func TestFailedSessionWritesDoNotConfirmLoginOrLogout(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("rafa", "Rafa", "senha-segura-de-teste")
	e.start(false)
	loggedIn := e.login("rafa", "senha-segura-de-teste")
	requireStatus(t, loggedIn, 200)
	cookie := sessionCookie(t, loggedIn)
	e.sql("REVOKE INSERT, DELETE ON " + e.db + ".* FROM '" + e.db + "'@'%'")
	e.disconnectDatabaseConnections()
	failed := e.login("rafa", "senha-segura-de-teste")
	requireStatus(t, failed, 500)
	if len(failed.cookies) != 0 {
		t.Fatal("login não persistido recebeu cookie")
	}
	failed = e.request("DELETE", "/api/session", "", cookie, nil)
	requireStatus(t, failed, 500)
	if len(failed.cookies) != 0 {
		t.Fatal("logout não persistido limpou cookie")
	}
	requireUser(t, e.request("GET", "/api/session", "", cookie, nil), "rafa", "Rafa")
	output, err := e.create("amigo", "Amigo", "senha-segura-de-teste")
	if err == nil || strings.Contains(output, "Conta criada.") {
		t.Fatalf("gravação negada confirmou conta: %v; %s", err, output)
	}
	e.sql("GRANT INSERT, DELETE ON " + e.db + ".* TO '" + e.db + "'@'%'")
	e.disconnectDatabaseConnections()
	requireStatus(t, e.request("DELETE", "/api/session", "", cookie, nil), 204)
	requireStatus(t, e.request("GET", "/api/session", "", cookie, nil), 401)
	requireStatus(t, e.login("amigo", "senha-segura-de-teste"), 401)
}

func TestDifferentLoginCaseCreatesDistinctAccounts(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("rafa", "Rafa", "senha-primeira-conta")
	e.mustCreate("Rafa", "Outra conta", "senha-segunda-conta")
	e.start(false)
	requireUser(t, e.login("rafa", "senha-primeira-conta"), "rafa", "Rafa")
	requireUser(t, e.login("Rafa", "senha-segunda-conta"), "Rafa", "Outra conta")
	requireStatus(t, e.login("RAFA", "senha-primeira-conta"), 401)
}

func TestUnavailableDatabaseFailsWithoutLeakingItsPassword(t *testing.T) {
	e := newEnvironment(t)
	command := e.command("create-user", "--name", "amigo", "--password", "senha-segura")
	command.Env = append(command.Env, "DB_HOST=127.0.0.1", "DB_PORT=1", "DB_CONNECT_TIMEOUT=1s")
	output, err := command.CombinedOutput()
	if err == nil || strings.Contains(string(output), "Conta criada.") {
		t.Fatalf("banco indisponível confirmou conta: %v; %s", err, output)
	}
	if bytes.Contains(output, []byte(mysqlEnvironment["DB_PASSWORD"])) {
		t.Fatal("erro expôs senha do banco")
	}
}

func TestTLSRejectsUntrustedDatabaseCertificate(t *testing.T) {
	e := newEnvironment(t)
	command := e.command("create-user", "--name", "amigo", "--password", "senha-segura")
	command.Env = append(command.Env, "DB_TLS=true", "DB_CONNECT_TIMEOUT=1s")
	output, err := command.CombinedOutput()
	if err == nil || !bytes.Contains(output, []byte("certificate")) {
		t.Fatalf("certificado sem confiança não foi recusado: %v; %s", err, output)
	}
}

func TestAccountCreatedByCommandCanAccessPrivateResource(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("rafa", "Rafa", "senha-segura-de-teste")
	e.start(false)
	result := e.login("rafa", "senha-segura-de-teste")
	requireUser(t, result, "rafa", "Rafa")
	cookie := sessionCookie(t, result)
	requireUser(t, e.request("GET", "/api/session", "", cookie, nil), "rafa", "Rafa")
}

func TestAccountCreatedWithPasswordArgumentCanLogIn(t *testing.T) {
	for _, example := range []struct {
		label, login, name, password string
		args                         []string
	}{
		{"nome como login", "rafa", "rafa", "senha123", []string{"--name", "rafa"}},
		{"nome separado", "rafa", "Rafa Silva", " senha '$!é\n", []string{"--login", "rafa", "--name", "Rafa Silva"}},
		{"apenas login", "amigo", "amigo", "senha123", []string{"--login", "amigo"}},
	} {
		t.Run(example.label, func(t *testing.T) {
			e := newEnvironment(t)
			args := append([]string{"create-user"}, example.args...)
			args = append(args, "--password", example.password)
			output, err := e.command(args...).CombinedOutput()
			if err != nil || !strings.Contains(string(output), "Conta criada.") {
				t.Fatalf("criar conta com argumentos: %v; %s", err, output)
			}
			e.start(false)
			requireUser(t, e.login(example.login, example.password), example.login, example.name)
		})
	}
}

func TestPasswordArgumentIsRequiredAndCannotBeCombinedWithStdin(t *testing.T) {
	for _, args := range [][]string{
		{},
		{"--password", ""},
		{"--password", "senha123", "--password-stdin"},
		{"--password", "", "--password-stdin"},
	} {
		e := newEnvironment(t)
		commandArgs := append([]string{"create-user", "--name", "rafa"}, args...)
		if output, err := e.command(commandArgs...).CombinedOutput(); err == nil {
			t.Fatalf("senha ausente ou ambígua aceita: %v; %s", args, output)
		}
	}
}

func TestInvalidCredentialsAndUnauthenticatedRequestsAreRejected(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("rafa", "Rafa", "senha-segura-de-teste")
	e.start(false)
	requireStatus(t, e.request("GET", "/api/session", "", nil, nil), 401)
	requireStatus(t, e.request("DELETE", "/api/session", "", nil, nil), 401)
	for _, credentials := range []struct{ login, password string }{
		{"rafa", "senha-incorreta"}, {"desconhecido", "senha-segura-de-teste"},
		{"rafa' OR 1=1 --", "senha-segura-de-teste"}, {"Rafa", "senha-segura-de-teste"},
		{"rafa ", "senha-segura-de-teste"}, {"rafa\t", "senha-segura-de-teste"},
	} {
		t.Run(credentials.login, func(t *testing.T) {
			r := e.login(credentials.login, credentials.password)
			requireStatus(t, r, 401)
			if len(r.cookies) != 0 {
				t.Fatal("credenciais inválidas receberam cookie")
			}
			if !bytes.Contains(r.body, []byte("Login ou senha inválidos.")) {
				t.Fatalf("erro inesperado: %s", r.body)
			}
		})
	}
	forged := &http.Cookie{Name: "mtg4fun_session", Value: strings.Repeat("a", 64)}
	requireStatus(t, e.request("GET", "/api/session", "", forged, nil), 401)
}

func TestAccountsAndSessionsSurviveServerRestart(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("rafa", "Rafa", "senha-duravel-de-teste")
	e.start(false)
	first := e.login("rafa", "senha-duravel-de-teste")
	requireUser(t, first, "rafa", "Rafa")
	cookie := sessionCookie(t, first)
	e.stop()
	e.start(false)
	requireUser(t, e.request("GET", "/api/session", "", cookie, nil), "rafa", "Rafa")
	requireUser(t, e.login("rafa", "senha-duravel-de-teste"), "rafa", "Rafa")
	e.stop()
	// Audit secrets separately from the public behavior assertions above.
	data := e.sql("SELECT password_hash FROM " + e.db + ".users; SELECT token_hash FROM " + e.db + ".sessions")
	if bytes.Contains(data, []byte("senha-duravel-de-teste")) || bytes.Contains(data, []byte(cookie.Value)) {
		t.Fatal("credencial em texto puro no armazenamento")
	}
	if !regexp.MustCompile(`\$2[aby]\$12\$[./A-Za-z0-9]{53}`).Match(data) {
		t.Fatal("hash bcrypt custo 12 ausente")
	}
}

func TestLogoutRevokesOnlyItsSessionAndRemainsRevokedAfterRestart(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("rafa", "Rafa", "senha-segura-de-teste")
	e.start(false)
	first := e.login("rafa", "senha-segura-de-teste")
	second := e.login("rafa", "senha-segura-de-teste")
	requireStatus(t, first, 200)
	requireStatus(t, second, 200)
	cookie := sessionCookie(t, first)
	result := e.request("DELETE", "/api/session", "", cookie, nil)
	requireStatus(t, result, 204)
	if sessionCookie(t, result).MaxAge != -1 {
		t.Fatal("logout não limpou cookie")
	}
	requireStatus(t, e.request("GET", "/api/session", "", cookie, nil), 401)
	requireUser(t, e.request("GET", "/api/session", "", sessionCookie(t, second), nil), "rafa", "Rafa")
	e.stop()
	e.start(false)
	requireStatus(t, e.request("GET", "/api/session", "", cookie, nil), 401)
}

func TestProvisioningWhileServerRunsAndDuplicateLoginDoesNotReplaceAccount(t *testing.T) {
	e := newEnvironment(t)
	e.start(false)
	e.mustCreate("amigo", "Amigo da mesa", "senha-original-do-amigo\r\n")
	output, err := e.create("amigo", "Outra pessoa", "senha-nova-diferente")
	if err == nil || !strings.Contains(output, "login já existe") {
		t.Fatalf("duplicata não foi recusada: %v; %s", err, output)
	}
	requireUser(t, e.login("amigo", "senha-original-do-amigo"), "amigo", "Amigo da mesa")
	requireStatus(t, e.login("amigo", "senha-nova-diferente"), 401)
}

func TestInvalidAccountInputIsRejectedWithoutCreatingAnAccount(t *testing.T) {
	e := newEnvironment(t)
	for _, example := range []struct{ label, login, name, password string }{
		{"login vazio", "", "Rafa", "senha-segura"},
		{"login inválido", "rafa amigo", "Rafa", "senha-segura"},
		{"nome vazio", "rafa", "   ", "senha-segura"},
		{"nome longo", "rafa", strings.Repeat("a", 101), "senha-segura"},
		{"senha curta", "rafa", "Rafa", "curta"},
		{"senha longa", "rafa", "Rafa", strings.Repeat("a", 73)},
		{"senha enorme", "rafa", "Rafa", strings.Repeat("a", 2000)},
		{"limite em bytes", "rafa", "Rafa", strings.Repeat("é", 37)},
	} {
		t.Run(example.label, func(t *testing.T) {
			if output, err := e.create(example.login, example.name, example.password); err == nil {
				t.Fatalf("entrada inválida aceita: %s", output)
			}
		})
	}
	e.start(false)
	requireStatus(t, e.login("rafa", "senha-segura"), 401)
	requireStatus(t, e.login("rafa", strings.Repeat("a", 72)), 401)
}

func TestPasswordAtByteLimitWorksWithoutTruncatingLongerPasswords(t *testing.T) {
	e := newEnvironment(t)
	password := strings.Repeat("é", 36)
	e.mustCreate("amigo", "Amigo", password)
	e.start(false)
	requireUser(t, e.login("amigo", password), "amigo", "Amigo")
	requireStatus(t, e.login("amigo", password+"x"), 401)
}

func TestSessionCookieAndSameOriginProtection(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("rafa", "Rafa", "senha-segura-de-teste")
	e.start(false)
	result := e.login("rafa", "senha-segura-de-teste")
	requireStatus(t, result, 200)
	cookie := sessionCookie(t, result)
	if !cookie.HttpOnly || cookie.SameSite != http.SameSiteStrictMode || cookie.Path != "/" || cookie.Secure || cookie.MaxAge != 86400 || cookie.Expires.Before(time.Now().Add(23*time.Hour)) {
		t.Fatalf("proteção do cookie inesperada: %s", cookie.String())
	}
	if result.header.Get("Cache-Control") != "no-store" {
		t.Fatal("resposta de login permite cache")
	}
	body := `{"login":"rafa","password":"senha-segura-de-teste"}`
	requireStatus(t, e.request("POST", "/api/session", body, nil, map[string]string{"Origin": "https://outro.example"}), 403)
	requireStatus(t, e.request("POST", "/api/session", body, nil, map[string]string{"Origin": "null"}), 403)
	requireStatus(t, e.request("POST", "/api/session", body, nil, map[string]string{"Sec-Fetch-Site": "cross-site"}), 403)
	requireStatus(t, e.request("POST", "/api/session", body, nil, map[string]string{"Origin": e.url}), 200)
	requireStatus(t, e.request("DELETE", "/api/session", "", cookie, map[string]string{"Origin": "https://outro.example"}), 403)
	requireUser(t, e.request("GET", "/api/session", "", cookie, nil), "rafa", "Rafa")
	e.stop()
	e.start(true)
	secured := e.request("POST", "/api/session", body, nil, map[string]string{"Origin": strings.Replace(e.url, "http://", "https://", 1)})
	requireStatus(t, secured, 200)
	if !sessionCookie(t, secured).Secure {
		t.Fatal("COOKIE_SECURE não protegeu o cookie")
	}
	requireStatus(t, e.request("POST", "/api/session", body, nil, map[string]string{"Origin": e.url}), 403)
}

func TestMalformedLoginRequestsAndPublicProvisioningRoutesAreRejected(t *testing.T) {
	e := newEnvironment(t)
	e.start(false)
	for _, body := range []string{`{`, `{"login":"rafa","password":"senha-segura","name":"Rafa"}`, `{"login":1}`, `{} {}`, strings.Repeat(" ", 4097)} {
		requireStatus(t, e.request("POST", "/api/session", body, nil, nil), 400)
	}
	requireStatus(t, e.request("POST", "/api/session", "{}", nil, map[string]string{"Content-Type": "text/plain"}), 415)
	for _, path := range []string{"/api/users", "/api/register", "/api/password-reset"} {
		requireStatus(t, e.request("POST", path, "{}", nil, nil), 404)
	}
	requireStatus(t, e.request("GET", "/api/inexistente", "", nil, nil), 404)
	requireStatus(t, e.request("POST", "/", "{}", nil, nil), 405)
}
