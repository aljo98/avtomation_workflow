using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.IO;
using System.Collections.Generic;
using System.Linq;

var builder = WebApplication.CreateBuilder(args);

// Allow CORS for local dev
builder.Services.AddCors(options =>
{
  options.AddPolicy("AllowAll", policy => policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});

var app = builder.Build();
app.UseCors("AllowAll");

app.MapGet("/health", () => Results.Json(new { status = "ok", service = "backend-dotnet" }));
app.MapGet("/", () => Results.Json(new { message = "Hello from Avtomation Workflow - .NET backend" }));

// data persistence directory
var dataDir = Path.Combine(AppContext.BaseDirectory, "..", "data");
if (!Directory.Exists(dataDir)) Directory.CreateDirectory(dataDir);

T LoadData<T>(string name)
{
  var p = Path.Combine(dataDir, name + ".json");
  if (!File.Exists(p)) return Activator.CreateInstance<T>();
  var txt = File.ReadAllText(p);
  return JsonSerializer.Deserialize<T>(txt) ?? Activator.CreateInstance<T>();
}

void SaveData<T>(string name, T data)
{
  var p = Path.Combine(dataDir, name + ".json");
  File.WriteAllText(p, JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true }));
}

var workflows = LoadData<List<Workflow>>("workflows") ?? new List<Workflow>();
var users = LoadData<List<User>>("users") ?? new List<User>();
var executions = LoadData<List<Execution>>("executions") ?? new List<Execution>();

app.MapPost("/auth/register", async (HttpRequest req) =>
{
  var body = await JsonSerializer.DeserializeAsync<Dictionary<string, string>>(req.Body);
  if (body == null || !body.ContainsKey("email") || !body.ContainsKey("password")) return Results.BadRequest(new { error = "email and password required" });
  if (users.Any(u => u.Email == body["email"])) return Results.BadRequest(new { error = "user exists" });
  var id = Guid.NewGuid().ToString("n").Substring(0, 10);
  var salt = Guid.NewGuid().ToString("n").Substring(0, 8);
  var hash = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(body["password"] + salt));
  var hashHex = BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
  var user = new User { Id = id, Email = body["email"], Name = body.GetValueOrDefault("name"), Salt = salt, Hash = hashHex };
  users.Add(user);
  SaveData("users", users);
  // return created user (minus sensitive fields)
  return Results.Created($"/users/{id}", new { id = user.Id, email = user.Email, name = user.Name });
});

app.MapPost("/auth/login", async (HttpRequest req) =>
{
  var body = await JsonSerializer.DeserializeAsync<Dictionary<string, string>>(req.Body);
  if (body == null) return Results.Unauthorized();
  var user = users.FirstOrDefault(u => u.Email == body.GetValueOrDefault("email"));
  if (user == null) return Results.Unauthorized();
  var hash = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(body.GetValueOrDefault("password") + user.Salt));
  var hashHex = BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
  if (hashHex != user.Hash) return Results.Unauthorized();
  var token = "dotnet-token-" + user.Id;
  return Results.Ok(new { token });
});

// Helper to verify token format and existence
User? VerifyToken(string? authHeader)
{
  if (string.IsNullOrEmpty(authHeader)) return null;
  var parts = authHeader.Split(' ');
  var token = parts.Length == 2 ? parts[1] : parts[0];
  if (!token.StartsWith("dotnet-token-")) return null;
  var uid = token.Substring("dotnet-token-".Length);
  return users.FirstOrDefault(u => u.Id == uid);
}

app.MapGet("/workflows", () => Results.Json(workflows));
app.MapGet("/workflows/{id}", (string id) =>
{
  var wf = workflows.FirstOrDefault(w => w.Id == id);
  if (wf == null) return Results.NotFound(new { error = "Not found" });
  return Results.Json(wf);
});

app.MapPost("/workflows", async (HttpRequest req) =>
{
  if (!req.Headers.ContainsKey("Authorization")) return Results.Unauthorized();
  var user = VerifyToken(req.Headers["Authorization"].ToString());
  if (user == null) return Results.Unauthorized();
  var body = await JsonSerializer.DeserializeAsync<Dictionary<string, string>>(req.Body);
  var id = Guid.NewGuid().ToString("n").Substring(0, 9);
  var wf = new Workflow { Id = id, Name = body.GetValueOrDefault("name"), Description = body.GetValueOrDefault("description") };
  workflows.Add(wf);
  SaveData("workflows", workflows);
  return Results.Created($"/workflows/{id}", wf);
});

app.MapPut("/workflows/{id}", async (string id, HttpRequest req) =>
{
  if (!req.Headers.ContainsKey("Authorization")) return Results.Unauthorized();
  var user = VerifyToken(req.Headers["Authorization"].ToString());
  if (user == null) return Results.Unauthorized();
  var body = await JsonSerializer.DeserializeAsync<Dictionary<string, string>>(req.Body);
  var idx = workflows.FindIndex(w => w.Id == id);
  if (idx == -1) return Results.NotFound(new { error = "Not found" });
  workflows[idx].Name = body.GetValueOrDefault("name") ?? workflows[idx].Name;
  workflows[idx].Description = body.GetValueOrDefault("description") ?? workflows[idx].Description;
  SaveData("workflows", workflows);
  return Results.Json(workflows[idx]);
});

app.MapDelete("/workflows/{id}", (string id, HttpRequest req) =>
{
  if (!req.Headers.ContainsKey("Authorization")) return Results.Unauthorized();
  var user = VerifyToken(req.Headers["Authorization"].ToString());
  if (user == null) return Results.Unauthorized();
  var idx = workflows.FindIndex(w => w.Id == id);
  if (idx == -1) return Results.NotFound(new { error = "Not found" });
  workflows.RemoveAt(idx);
  SaveData("workflows", workflows);
  return Results.Ok(new { success = true });
});

app.MapPost("/workflows/{id}/execute", (string id, HttpRequest req) =>
{
  if (!req.Headers.ContainsKey("Authorization")) return Results.Unauthorized();
  var user = VerifyToken(req.Headers["Authorization"].ToString());
  if (user == null) return Results.Unauthorized();
  var wf = workflows.FirstOrDefault(w => w.Id == id);
  if (wf == null) return Results.NotFound(new { error = "Workflow not found" });
  var execId = Guid.NewGuid().ToString("n").Substring(0, 9);
  var exec = new Execution { Id = execId, WorkflowId = id, Status = "running", StartedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), Logs = new List<ExecLog>() };
  executions.Add(exec);
  SaveData("executions", executions);
  // simulate execution
  _ = Task.Run(async () =>
  {
    await Task.Delay(1000);
    exec.Status = "success";
    exec.FinishedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    exec.Logs.Add(new ExecLog { Level = "info", Message = "Execution finished" });
    SaveData("executions", executions);
  });
  return Results.Accepted($"/executions/{execId}", new { executionId = execId });
});

app.MapGet("/workflows/{id}/executions", (string id) => Results.Json(executions.Where(e => e.WorkflowId == id)));
app.MapGet("/executions/{id}", (string id) =>
{
  var ex = executions.FirstOrDefault(e => e.Id == id);
  if (ex == null) return Results.NotFound();
  return Results.Json(ex);
});

app.Run();

// --- Models ---
public class User
{
  public string Id { get; set; } = "";
  public string Email { get; set; } = "";
  public string? Name { get; set; }
  public string Salt { get; set; } = "";
  public string Hash { get; set; } = "";
}

public class Workflow
{
  public string Id { get; set; } = "";
  public string? Name { get; set; }
  public string? Description { get; set; }
}

public class Execution
{
  public string Id { get; set; } = "";
  public string WorkflowId { get; set; } = "";
  public string Status { get; set; } = "";
  public long StartedAt { get; set; }
  public long? FinishedAt { get; set; }
  public List<ExecLog> Logs { get; set; } = new List<ExecLog>();
}

public class ExecLog
{
  public string Level { get; set; } = "info";
  public string Message { get; set; } = "";
}
