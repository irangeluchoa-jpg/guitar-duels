import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Rotas que só podem ser acessadas após navegar pelo app
// Se o usuário acessar diretamente (sem referer interno), redireciona para /
const INTERNAL_ONLY = ["/settings", "/ranking", "/lobby", "/songs"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Verifica se é uma rota interna sendo acessada diretamente
  const isInternalRoute = INTERNAL_ONLY.some(r => pathname.startsWith(r))
  if (!isInternalRoute) return NextResponse.next()

  // Verifica se veio de dentro do próprio site (referer)
  const referer = request.headers.get("referer") || ""
  const host = request.headers.get("host") || ""
  const isInternalNavigation = referer.includes(host) && referer !== ""

  // Se não tem referer interno, redireciona para o menu
  if (!isInternalNavigation) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/settings", "/ranking", "/lobby", "/songs"],
}
