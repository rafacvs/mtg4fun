package integration_test

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
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"
)

var executable string
var mysqlEnvironment map[string]string
var databaseNumber int

func TestMain(m *testing.M) {
	directory, err := os.MkdirTemp("", "mtg4fun-cli-tests-")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	executable = filepath.Join(directory, "mtg4fun")
	output, err := exec.Command("go", "build", "-o", executable, "../../cmd/mtg4fun").CombinedOutput()
	if err != nil {
		fmt.Fprintf(os.Stderr, "build: %s\n%v\n", output, err)
		os.RemoveAll(directory)
		os.Exit(1)
	}
	output, err = exec.Command("python3", "../../../scripts/test-mysql.py").CombinedOutput()
	if err != nil {
		fmt.Fprintf(os.Stderr, "MySQL: %v; %s\n", err, output)
		os.RemoveAll(directory)
		os.Exit(1)
	}
	if err := json.Unmarshal(output, &mysqlEnvironment); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	code := m.Run()
	if output, err := exec.Command("docker", "rm", "-f", "-v", mysqlEnvironment["container"]).CombinedOutput(); err != nil {
		fmt.Fprintf(os.Stderr, "cleanup: %v; %s\n", err, output)
		code = 1
	}
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
	logs    string
}

func newEnvironment(t *testing.T) *environment {
	t.Helper()
	directory := t.TempDir()
	databaseNumber++
	e := &environment{t: t, db: "access_" + strconv.Itoa(databaseNumber), web: filepath.Join(directory, "web")}
	e.sql("CREATE DATABASE " + e.db)
	e.sql("CREATE USER '" + e.db + "'@'%' IDENTIFIED BY '" + mysqlEnvironment["DB_PASSWORD"] + "'; GRANT ALL ON " + e.db + ".* TO '" + e.db + "'@'%'")
	t.Cleanup(func() { e.sql("DROP DATABASE " + e.db + "; DROP USER '" + e.db + "'@'%'") })
	if err := os.Mkdir(e.web, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(e.web, "index.html"), []byte("<!doctype html><html lang=pt-BR>mtg4fun</html>"), 0600); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(e.stop)
	return e
}

func (e *environment) command(args ...string) *exec.Cmd {
	command := exec.Command(executable, args...)
	for _, value := range os.Environ() {
		if !strings.HasPrefix(value, "DB_") && !strings.HasPrefix(value, "COOKIE_SECURE=") {
			command.Env = append(command.Env, value)
		}
	}
	for key, value := range mysqlEnvironment {
		if strings.HasPrefix(key, "DB_") {
			command.Env = append(command.Env, key+"="+value)
		}
	}
	command.Env = append(command.Env, "DB_NAME="+e.db, "DB_USER="+e.db)
	return command
}

func (e *environment) sql(statement string) []byte {
	e.t.Helper()
	output, err := exec.Command("docker", "exec", "--env", "MYSQL_PWD="+mysqlEnvironment["DB_PASSWORD"], mysqlEnvironment["container"], "mysql", "-u", "root", "--batch", "--skip-column-names", "-e", statement).CombinedOutput()
	if err != nil {
		e.t.Fatalf("preparar/auditar banco: %v; %s", err, output)
	}
	return output
}

func (e *environment) disconnectDatabaseConnections() {
	e.t.Helper()
	// MySQL caches database grants per connection. Reconnect after changing
	// permissions so the failure scenario exercises the new grants.
	statements := e.sql("SELECT CONCAT('KILL ', ID, ';') FROM information_schema.PROCESSLIST WHERE USER = '" + e.db + "'")
	if len(bytes.TrimSpace(statements)) != 0 {
		e.sql(string(statements))
	}
}

func (e *environment) create(login, name, password string) (string, error) {
	e.t.Helper()
	command := e.command("create-user", "--login", login, "--name", name, "--password-stdin")
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
	e.process = e.command("serve", "--addr", "127.0.0.1:0", "--web", e.web)
	e.process.Env = append(e.process.Env, fmt.Sprintf("COOKIE_SECURE=%t", secure))
	logFile, err := os.CreateTemp(e.t.TempDir(), "server-*.log")
	if err != nil {
		e.t.Fatal(err)
	}
	defer logFile.Close()
	e.logs = logFile.Name()
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
