export function GET() {
  return Response.json({
    ok: true,
    app: "redgarlic-internal",
    date: new Date().toISOString(),
  });
}
