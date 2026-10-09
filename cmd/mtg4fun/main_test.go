package main_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"syscall"
	"testing"
	"time"
)

var executable string

func TestMain(m *testing.M) {
	directory, err := os.MkdirTemp("", "mtg4fun-cli-tests-")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	executable = filepath.Join(directory, "mtg4fun")
	output, err := exec.Command("go", "build", "-o", executable, ".").CombinedOutput()
	if err != nil {
		fmt.Fprintf(os.Stderr, "build: %s\n%v\n", output, err)
		os.RemoveAll(directory)
		os.Exit(1)
	}
	code := m.Run()
	os.RemoveAll(directory)
	os.Exit(code)
}

type environment struct {
	t       *testing.T
	db      string
	web     string
	process *exec.Cmd
	done    chan error
	url     string
}

func newEnvironment(t *testing.T) *environment {
	t.Helper()
	directory := t.TempDir()
	e := &environment{t: t, db: filepath.Join(directory, "contas com espaços.db"), web: filepath.Join(directory, "web")}
	if err := os.Mkdir(e.web, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(e.web, "index.html"), []byte("<!doctype html><html lang=pt-BR>mtg4fun</html>"), 0600); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(e.stop)
	return e
}

func (e *environment) create(login, name, password string) (string, error) {
	e.t.Helper()
	command := exec.Command(executable, "create-user", "--db", e.db, "--login", login, "--name", name, "--password-stdin")
	command.Stdin = strings.NewReader(password)
	output, err := command.CombinedOutput()
	return string(output), err
}

func (e *environment) mustCreate(login, name, password string) {
	e.t.Helper()
	if output, err := e.create(login, name, password); err != nil {
		e.t.Fatalf("criar conta: %v; %s", err, output)
	}
}

func (e *environment) start(secure bool) {
	e.t.Helper()
	e.process = exec.Command(executable, "serve", "--db", e.db, "--addr", "127.0.0.1:0", "--web", e.web)
	e.process.Env = append(os.Environ(), fmt.Sprintf("COOKIE_SECURE=%t", secure))
	logFile, err := os.CreateTemp(e.t.TempDir(), "server-*.log")
	if err != nil {
		e.t.Fatal(err)
	}
	defer logFile.Close()
	e.process.Stdout, e.process.Stderr = logFile, logFile
	if err := e.process.Start(); err != nil {
		e.t.Fatal(err)
	}
	e.done = make(chan error, 1)
	go func() { e.done <- e.process.Wait() }()
	deadline := time.Now().Add(10 * time.Second)
	address := regexp.MustCompile(`HTTP ouvindo em (127\.0\.0\.1:\d+)`)
	for time.Now().Before(deadline) {
		output, err := os.ReadFile(logFile.Name())
		if err != nil {
			e.t.Fatal(err)
		}
		if match := address.FindSubmatch(output); match != nil {
			e.url = "http://" + string(match[1])
			return
		}
		select {
		case err := <-e.done:
			e.process = nil
			e.t.Fatalf("servidor encerrou: %v; %s", err, output)
		default:
		}
		time.Sleep(20 * time.Millisecond)
	}
	e.t.Fatal("servidor não ficou pronto")
}

func (e *environment) stop() {
	e.t.Helper()
	if e.process == nil {
		return
	}
	_ = e.process.Process.Signal(syscall.SIGTERM)
	select {
	case err := <-e.done:
		if err != nil {
			e.t.Errorf("servidor encerrou com erro: %v", err)
		}
	case <-time.After(12 * time.Second):
		_ = e.process.Process.Kill()
		<-e.done
		e.t.Error("servidor não encerrou")
	}
	e.process = nil
}

type response struct {
	status  int
	header  http.Header
	cookies []*http.Cookie
	body    []byte
}

func (e *environment) request(method, path, body string, cookie *http.Cookie, headers map[string]string) response {
	e.t.Helper()
	request, err := http.NewRequest(method, e.url+path, strings.NewReader(body))
	if err != nil {
		e.t.Fatal(err)
	}
	if body != "" {
		request.Header.Set("Content-Type", "application/json")
	}
	if cookie != nil {
		request.AddCookie(cookie)
	}
	for key, value := range headers {
		request.Header.Set(key, value)
	}
	client := &http.Client{Timeout: 10 * time.Second}
	result, err := client.Do(request)
	if err != nil {
		e.t.Fatal(err)
	}
	defer result.Body.Close()
	data, err := io.ReadAll(result.Body)
	if err != nil {
		e.t.Fatal(err)
	}
	return response{status: result.StatusCode, header: result.Header, cookies: result.Cookies(), body: data}
}

func (e *environment) login(login, password string) response {
	e.t.Helper()
	data, err := json.Marshal(map[string]string{"login": login, "password": password})
	if err != nil {
		e.t.Fatal(err)
	}
	return e.request("POST", "/api/session", string(data), nil, nil)
}

func requireStatus(t *testing.T, r response, want int) {
	t.Helper()
	if r.status != want {
		t.Fatalf("status %d, esperado %d; %s", r.status, want, r.body)
	}
}

func sessionCookie(t *testing.T, r response) *http.Cookie {
	t.Helper()
	for _, c := range r.cookies {
		if c.Name == "mtg4fun_session" {
			return c
		}
	}
	t.Fatal("cookie de sessão ausente")
	return nil
}

func requireUser(t *testing.T, r response, login, name string) {
	t.Helper()
	requireStatus(t, r, 200)
	var payload struct {
		User struct {
			ID    int64  `json:"id"`
			Login string `json:"login"`
			Name  string `json:"name"`
		} `json:"user"`
	}
	if err := json.Unmarshal(r.body, &payload); err != nil {
		t.Fatal(err)
	}
	if payload.User.ID <= 0 || payload.User.Login != login || payload.User.Name != name {
		t.Fatalf("usuário inesperado: %s", r.body)
	}
	if bytes.Contains(r.body, []byte("password")) || bytes.Contains(r.body, []byte("token")) {
		t.Fatalf("resposta expôs credenciais: %s", r.body)
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

func TestInvalidCredentialsAndUnauthenticatedRequestsAreRejected(t *testing.T) {
	e := newEnvironment(t)
	e.mustCreate("rafa", "Rafa", "senha-segura-de-teste")
	e.start(false)
	requireStatus(t, e.request("GET", "/api/session", "", nil, nil), 401)
	requireStatus(t, e.request("DELETE", "/api/session", "", nil, nil), 401)
	for _, credentials := range []struct{ login, password string }{
		{"rafa", "senha-incorreta"}, {"desconhecido", "senha-segura-de-teste"},
		{"rafa' OR 1=1 --", "senha-segura-de-teste"}, {"Rafa", "senha-segura-de-teste"},
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
	// Audit the durable artifacts without relying on the schema or SQL queries.
	files, err := filepath.Glob(e.db + "*")
	if err != nil || len(files) == 0 {
		t.Fatalf("arquivos duráveis ausentes: %v", err)
	}
	hashPattern := regexp.MustCompile(`\$2[aby]\$12\$[./A-Za-z0-9]{53}`)
	foundHash := false
	for _, file := range files {
		data, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		if bytes.Contains(data, []byte("senha-duravel-de-teste")) {
			t.Fatal("senha em texto puro no armazenamento")
		}
		if bytes.Contains(data, []byte(cookie.Value)) {
			t.Fatal("token de sessão em texto puro no armazenamento")
		}
		foundHash = foundHash || hashPattern.Match(data)
	}
	if !foundHash {
		t.Fatal("hash bcrypt custo 12 ausente no armazenamento")
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
