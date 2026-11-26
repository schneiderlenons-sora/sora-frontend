import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Widget "Lançar rápido"
//
// Quatro botões: Gasto, Receita, Áudio e Foto. Todos levam à conversa com a
// Sora no WhatsApp (Gasto e Receita já com "gastei " / "recebi " escrito).
//
// ⚠️ NO IPHONE, O TOQUE NUM WIDGET SEMPRE ABRE O PRÓPRIO APP — um widget não
// abre outro app direto. Cada botão roda a `AbrirLancamentoIntent`, que abre a
// ForSora e, já dentro dela, troca pela conversa no WhatsApp (ver o arquivo da
// intenção: ela entra nos DOIS alvos).
//
// ⚠️ Num widget PEQUENO, só botões com "ação" (AppIntent) têm alvos de toque
// separados — `Link` só funciona do tamanho médio pra cima.
// ⚠️ NÃO voltar para `Button(intent: OpenURLIntent(url))`: no build 6 o toque
// não fazia nada.

/// O que cada botão faz.
enum AcaoLancar: String, CaseIterable {
    case gasto, receita, audio, foto

    var titulo: String {
        switch self {
        case .gasto: return "Gasto"
        case .receita: return "Receita"
        case .audio: return "Áudio"
        case .foto: return "Foto"
        }
    }

    var simbolo: String {
        switch self {
        case .gasto: return "minus.circle"
        case .receita: return "plus.circle"
        case .audio: return "mic"
        case .foto: return "camera"
        }
    }

    var rotuloAcessivel: String {
        switch self {
        case .gasto: return "Lançar gasto no WhatsApp"
        case .receita: return "Lançar receita no WhatsApp"
        case .audio: return "Mandar áudio no WhatsApp"
        case .foto: return "Mandar foto do comprovante no WhatsApp"
        }
    }

    /// Link da própria ForSora. O app recebe e passa para o WhatsApp
    /// (ver `AtalhoLancar` no SceneDelegate). Se abrir no navegador, o site
    /// redireciona para o mesmo lugar (app/lancar/[acao]).
    var endereco: URL {
        URL(string: "https://www.forsora.com/lancar/\(rawValue)")!
    }

    func corIcone(escuro: Bool) -> Color {
        switch self {
        case .gasto: return escuro ? Color(hex: 0xFF8F93) : Color(hex: 0xC8323A)
        case .receita: return escuro ? Color(hex: 0x7FE09A) : Color(hex: 0x1F7A45)
        case .audio: return escuro ? Color(hex: 0x7DB8FF) : Color(hex: 0x0A64CF)
        case .foto: return escuro ? Color(hex: 0xFFC266) : Color(hex: 0x9A5B00)
        }
    }

    func corFundo(escuro: Bool) -> Color {
        switch self {
        case .gasto: return escuro ? Color(hex: 0xFF6B70, opacidade: 0.15) : Color(hex: 0xE5484D, opacidade: 0.09)
        case .receita: return Color(hex: 0x61D17B, opacidade: 0.15)
        case .audio: return escuro ? Color(hex: 0x64AAFF, opacidade: 0.15) : Color(hex: 0x0A6CDF, opacidade: 0.09)
        case .foto: return escuro ? Color(hex: 0xFFB347, opacidade: 0.15) : Color(hex: 0xF5A623, opacidade: 0.13)
        }
    }
}

/// Widgets só para assinantes (decisão do dono): sem conexão o widget pede
/// pra conectar, e fora do plano diz que não faz parte do plano. Sem internet
/// (nunca conseguiu conferir), os botões aparecem — eles só abrem o WhatsApp.
enum SituacaoLancar {
    case liberado, conectar, foraDoPlano
}

struct LancarEntrada: TimelineEntry {
    let date: Date
    let situacao: SituacaoLancar
}

private func situacaoDoLancar(_ s: SituacaoWidget) -> SituacaoLancar {
    switch s {
    case .desconectado: return .conectar
    case .foraDoPlano: return .foraDoPlano
    default: return .liberado
    }
}

struct LancarProvedor: TimelineProvider {
    func placeholder(in context: Context) -> LancarEntrada {
        LancarEntrada(date: .now, situacao: .liberado)
    }

    func getSnapshot(in context: Context, completion: @escaping (LancarEntrada) -> Void) {
        if context.isPreview {
            completion(LancarEntrada(date: .now, situacao: .liberado))
            return
        }
        Task {
            completion(LancarEntrada(date: .now, situacao: situacaoDoLancar(await ServicoResumo.buscar())))
        }
    }

    /// Confere a conexão e o plano a cada 3 horas (barato: o servidor responde
    /// 304 quando nada mudou).
    func getTimeline(in context: Context, completion: @escaping (Timeline<LancarEntrada>) -> Void) {
        Task {
            let e = LancarEntrada(date: .now, situacao: situacaoDoLancar(await ServicoResumo.buscar()))
            completion(Timeline(entries: [e], policy: .after(Date().addingTimeInterval(3 * 60 * 60))))
        }
    }
}

struct LancarVista: View {
    let situacao: SituacaoLancar

    var body: some View {
        switch situacao {
        case .conectar: EstadoConectar()
        case .foraDoPlano: EstadoForaDoPlano()
        case .liberado: LancarBotoes()
        }
    }
}

struct LancarBotoes: View {
    @Environment(\.colorScheme) private var esquema
    @Environment(\.widgetRenderingMode) private var modo

    var body: some View {
        let escuro = esquema == .dark
        Grid(horizontalSpacing: 8, verticalSpacing: 8) {
            GridRow {
                botao(.gasto, escuro: escuro)
                botao(.receita, escuro: escuro)
            }
            GridRow {
                botao(.audio, escuro: escuro)
                botao(.foto, escuro: escuro)
            }
        }
        .padding(13)
    }

    private func botao(_ acao: AcaoLancar, escuro: Bool) -> some View {
        // Na tela inicial "tingida" do iOS 18 as cores somem: o fundo do botão
        // vira um vidro neutro e o ícone acompanha a cor que a pessoa escolheu.
        let colorido = modo == .fullColor
        return Button(intent: AbrirLancamentoIntent(acao: acao.rawValue)) {
            VStack(spacing: 6) {
                Image(systemName: acao.simbolo)
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(colorido ? acao.corIcone(escuro: escuro) : Color.primary)
                    .widgetAccentable()
                Text(acao.titulo)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.primary)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(
                RoundedRectangle(cornerRadius: 15, style: .continuous)
                    .fill(colorido ? acao.corFundo(escuro: escuro) : Color.primary.opacity(0.08))
            )
            .contentShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(acao.rotuloAcessivel)
    }
}

struct LancarWidget: Widget {
    let kind = "SoraLancar"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LancarProvedor()) { entrada in
            LancarVista(situacao: entrada.situacao)
                .containerBackground(for: .widget) {
                    FundoWidget()
                }
        }
        .configurationDisplayName("Lançar rápido")
        .description("Gasto, receita, áudio ou foto direto no WhatsApp, em um toque.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

/// Branco no claro, grafite no escuro (o mesmo dos widgets do sistema).
struct FundoWidget: View {
    @Environment(\.colorScheme) private var esquema

    var body: some View {
        esquema == .dark ? Color(hex: 0x1C1C1E) : Color.white
    }
}

extension Color {
    init(hex: UInt32, opacidade: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacidade
        )
    }
}
