using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/health", () => Results.Json(new { status = "ok", service = "backend-dotnet" }));
app.MapGet("/", () => Results.Json(new { message = "Hello from Avtomation Workflow - .NET backend" }));

app.Run();
