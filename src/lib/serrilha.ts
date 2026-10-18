// Borda cortada pela lâmina do aplicador, como polygon() de clip-path. Os dentes ficam
// numa ponta só: a outra continua reta, porque a fita segue (ou some na borda da tela).
export function pontaSerrilhada(lado: "esquerda" | "direita", dentes = 5, dente = "0.3rem"): string {
  const passos = dentes * 2;
  const pontos = Array.from({ length: passos + 1 }, (_, i) => {
    const y = `${(i / passos) * 100}%`;
    const recuado = i % 2 === 0;
    return lado === "direita" ? `${recuado ? `calc(100% - ${dente})` : "100%"} ${y}` : `${recuado ? dente : "0"} ${y}`;
  });
  return lado === "direita"
    ? `polygon(0 0, ${pontos.join(", ")}, 0 100%)`
    : `polygon(100% 0, 100% 100%, ${pontos.reverse().join(", ")})`;
}
