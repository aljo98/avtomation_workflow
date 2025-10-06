using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/health", () => Results.Json(new { status = "ok", service = "backend-dotnet" }));
app.MapGet("/", () => Results.Json(new { message = "Hello from Avtomation Workflow - .NET backend" }));

var workflows = new List<dynamic>();
var users = new List<dynamic>();
var executions = new List<dynamic>();

app.MapPost("/auth/register", (HttpRequest req) => {
	var body = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string,string>>(new StreamReader(req.Body).ReadToEnd());
	if (!body.ContainsKey("email") || !body.ContainsKey("password")) return Results.BadRequest(new { error = "email and password required"});
	if (users.Any(u => u.email == body["email"])) return Results.BadRequest(new { error = "user exists"});
	var id = Guid.NewGuid().ToString("n").Substring(0,10);
	var salt = Guid.NewGuid().ToString("n").Substring(0,8);
	var hash = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(body["password"]+salt));
	var hashHex = BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
	users.Add(new { id = id, email = body["email"], salt = salt, hash = hashHex });
	return Results.Created($"/users/{id}", new { id, email = body["email"] });
});

app.MapPost("/auth/login", (HttpRequest req) => {
	var body = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string,string>>(new StreamReader(req.Body).ReadToEnd());
	var user = users.FirstOrDefault(u => u.email == body["email"]);
	if (user == null) return Results.Unauthorized();
	var hash = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(body["password"]+user.salt));
	var hashHex = BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
	if (hashHex != user.hash) return Results.Unauthorized();
	// simple token
	var token = "dotnet-token-" + user.id;
	return Results.Ok(new { token });
});

app.MapGet("/workflows", () => Results.Json(workflows));
app.MapPost("/workflows", (HttpRequest req) => {
	if (!req.Headers.ContainsKey("Authorization")) return Results.Unauthorized();
	var body = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string,string>>(new StreamReader(req.Body).ReadToEnd());
	var id = Guid.NewGuid().ToString("n").Substring(0,9);
	var wf = new { id = id, name = body.GetValueOrDefault("name"), description = body.GetValueOrDefault("description") };
	workflows.Add(wf);
	return Results.Created($"/workflows/{id}", wf);
});

app.MapPost("/workflows/{id}/execute", (string id) => {
	var wf = workflows.FirstOrDefault(w => w.id == id);
	if (wf == null) return Results.NotFound(new { error = "Workflow not found" });
	var execId = Guid.NewGuid().ToString("n").Substring(0,9);
	var exec = new { id = execId, workflowId = id, status = "running", startedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() };
	executions.Add(exec);
	// simulate
	Task.Run(async () => { await Task.Delay(1000); exec = new { id = execId, workflowId = id, status = "success", startedAt = exec.startedAt, finishedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() }; });
	return Results.Accepted($"/executions/{execId}", new { executionId = execId });
});

app.MapGet("/workflows/{id}/executions", (string id) => Results.Json(executions.Where(e => e.workflowId == id)));
app.MapGet("/executions/{id}", (string id) => {
	var ex = executions.FirstOrDefault(e => e.id == id);
	if (ex == null) return Results.NotFound();
	return Results.Json(ex);
});

app.Run();
