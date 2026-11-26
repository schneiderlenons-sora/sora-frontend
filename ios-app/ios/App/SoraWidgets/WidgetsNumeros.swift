import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Os widgets com números (fase 2): Livre pra gastar, Próximas contas, Cartão
//
// O visual segue a prévia aprovada pelo dono (claude.ai/artifact/29FwHYfxW4KQT3F87CT9zo).
// Os números e os textos vêm prontos do servidor (ServicoResumo): aqui só se
// desenha. Cada widget tem "Mostrar valores" (toque e segure → Editar widget);
// o do cartão também deixa escolher o cartão.

// MARK: Opções

struct OpcoesValores: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Opções"
    static var description = IntentDescription("Escolha o que o widget mostra.")

    @Parameter(title: "Mostrar valores", default: true)
    var mostrarValores: Bool
}

struct CartaoEntidade: AppEntity {
    let id: String
    let nome: String

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Cartão"
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(nome)") }
    static var defaultQuery = CartaoConsulta()
}

struct CartaoConsulta: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [CartaoEntidade] {
        await cartoes().filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [CartaoEntidade] {
        await cartoes()
    }

    func defaultResult() async -> CartaoEntidade? {
        await cartoes().first
    }

    private func cartoes() async -> [CartaoEntidade] {
        var lista = ServicoResumo.guardado()?.0.cartoes ?? []
        if lista.isEmpty, case .ok(let r, _, _) = await ServicoResumo.buscar() {
            lista = r.cartoes ?? []
        }
        return lista.map { CartaoEntidade(id: $0.id, nome: $0.nome) }
    }
}

struct OpcoesCartao: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Cartão"
    static var description = IntentDescription("Escolha o cartão e o que o widget mostra.")

    @Parameter(title: "Cartão")
    var cartao: CartaoEntidade?

    @Parameter(title: "Mostrar valores", default: true)
    var mostrarValores: Bool
}

// MARK: Entrada e provedores

struct EntradaNumeros: TimelineEntry {
    let date: Date
    let situacao: SituacaoWidget
    let mostrarValores: Bool
    let cartaoId: String?
}

/// Uma hora entre atualizações (o iOS pode espaçar mais). Barato: na maioria
/// das vezes o servidor responde "nada mudou" (304).
private func proxima() -> Date { Date().addingTimeInterval(60 * 60) }

struct ProvedorValores: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> EntradaNumeros {
        EntradaNumeros(date: .now, situacao: Amostra.situacao, mostrarValores: true, cartaoId: nil)
    }

    func snapshot(for configuration: OpcoesValores, in context: Context) async -> EntradaNumeros {
        if context.isPreview {
            return EntradaNumeros(date: .now, situacao: Amostra.situacao, mostrarValores: configuration.mostrarValores, cartaoId: nil)
        }
        return EntradaNumeros(date: .now, situacao: await ServicoResumo.buscar(), mostrarValores: configuration.mostrarValores, cartaoId: nil)
    }

    func timeline(for configuration: OpcoesValores, in context: Context) async -> Timeline<EntradaNumeros> {
        let e = EntradaNumeros(date: .now, situacao: await ServicoResumo.buscar(), mostrarValores: configuration.mostrarValores, cartaoId: nil)
        return Timeline(entries: [e], policy: .after(proxima()))
    }
}

struct ProvedorCartao: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> EntradaNumeros {
        EntradaNumeros(date: .now, situacao: Amostra.situacao, mostrarValores: true, cartaoId: nil)
    }

    func snapshot(for configuration: OpcoesCartao, in context: Context) async -> EntradaNumeros {
        if context.isPreview {
            return EntradaNumeros(date: .now, situacao: Amostra.situacao, mostrarValores: configuration.mostrarValores, cartaoId: nil)
        }
        return EntradaNumeros(date: .now, situacao: await ServicoResumo.buscar(),
                              mostrarValores: configuration.mostrarValores, cartaoId: configuration.cartao?.id)
    }

    func timeline(for configuration: OpcoesCartao, in context: Context) async -> Timeline<EntradaNumeros> {
        let e = EntradaNumeros(date: .now, situacao: await ServicoResumo.buscar(),
                               mostrarValores: configuration.mostrarValores, cartaoId: configuration.cartao?.id)
        return Timeline(entries: [e], policy: .after(proxima()))
    }
}

// MARK: Os widgets

struct LivreWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "SoraLivre", intent: OpcoesValores.self, provider: ProvedorValores()) { entrada in
            LivreVista(entrada: entrada)
                .containerBackground(for: .widget) { FundoWidget() }
        }
        .configurationDisplayName("Livre pra gastar")
        .description("Quanto dá pra gastar por dia até o fim do mês.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

struct ContasWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "SoraContas", intent: OpcoesValores.self, provider: ProvedorValores()) { entrada in
            ContasVista(entrada: entrada)
                .containerBackground(for: .widget) { FundoWidget() }
        }
        .configurationDisplayName("Próximas contas")
        .description("O que vence nos próximos 7 dias, com as atrasadas primeiro.")
        .supportedFamilies([.systemMedium])
        .contentMarginsDisabled()
    }
}

struct CartaoWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "SoraCartao", intent: OpcoesCartao.self, provider: ProvedorCartao()) { entrada in
            CartaoVista(entrada: entrada)
                .containerBackground(for: .widget) { FundoWidget() }
        }
        .configurationDisplayName("Cartão")
        .description("A fatura atual, quando fecha e quando vence.")
        .supportedFamilies([.systemSmall])
        .contentMarginsDisabled()
    }
}

// MARK: Cores

private let verdeMarca = Color(hex: 0x61D17B)

private struct CoresMare {
    let agua: Color, frente: Color, status: Color, texto: Color

    init(estado: String, escuro: Bool) {
        switch estado {
        case "apertado":
            agua = escuro ? Color(hex: 0xFFB347, opacidade: 0.17) : Color(hex: 0xF5A623, opacidade: 0.22)
            frente = escuro ? Color(hex: 0xFFB347, opacidade: 0.14) : Color(hex: 0xF5A623, opacidade: 0.17)
            status = escuro ? Color(hex: 0xFFC266) : Color(hex: 0x9A5B00)
            texto = escuro ? Color(hex: 0xFFD699) : Color(hex: 0x7A4800)
        case "vermelho":
            agua = escuro ? Color(hex: 0xFF6B70, opacidade: 0.20) : Color(hex: 0xE5484D, opacidade: 0.20)
            frente = escuro ? Color(hex: 0xFF6B70, opacidade: 0.16) : Color(hex: 0xE5484D, opacidade: 0.16)
            status = escuro ? Color(hex: 0xFF9497) : Color(hex: 0xB42318)
            texto = escuro ? Color(hex: 0xFFB8BA) : Color(hex: 0x8F1D22)
        default:
            agua = escuro ? Color(hex: 0x61D17B, opacidade: 0.17) : Color(hex: 0x61D17B, opacidade: 0.20)
            frente = escuro ? Color(hex: 0x61D17B, opacidade: 0.15) : Color(hex: 0x61D17B, opacidade: 0.17)
            status = escuro ? Color(hex: 0x86E3A0) : Color(hex: 0x1F7A45)
            texto = escuro ? Color(hex: 0xB7F0C6) : Color(hex: 0x145C33)
        }
    }
}

private func vermelho(_ escuro: Bool) -> Color { escuro ? Color(hex: 0xFF9497) : Color(hex: 0xB42318) }

private func horaCurta(_ d: Date) -> String {
    let f = DateFormatter()
    f.dateFormat = "HH:mm"
    return f.string(from: d)
}

// MARK: Livre pra gastar

/// A maré: o nível é quanto do dinheiro livre do mês ainda resta.
private struct Mare: Shape {
    let nivel: Double
    let fase: CGFloat
    let inverte: Bool

    func path(in r: CGRect) -> Path {
        var p = Path()
        let y = r.height * CGFloat(1 - nivel) + fase
        let a: CGFloat = inverte ? -4.5 : 4.5
        p.move(to: CGPoint(x: 0, y: y))
        p.addCurve(to: CGPoint(x: r.width * 0.5, y: y),
                   control1: CGPoint(x: r.width * 0.2, y: y - a),
                   control2: CGPoint(x: r.width * 0.34, y: y - a))
        p.addCurve(to: CGPoint(x: r.width, y: y),
                   control1: CGPoint(x: r.width * 0.66, y: y + a),
                   control2: CGPoint(x: r.width * 0.8, y: y + a))
        p.addLine(to: CGPoint(x: r.width, y: r.height))
        p.addLine(to: CGPoint(x: 0, y: r.height))
        p.closeSubpath()
        return p
    }
}

struct LivreVista: View {
    let entrada: EntradaNumeros

    var body: some View {
        switch entrada.situacao {
        case .ok(let r, let em, let offline):
            if let l = r.livre {
                LivreConteudo(l: l, mostrar: entrada.mostrarValores, atualizadoEm: em, offline: offline)
            } else {
                EstadoIndisponivel()
            }
        case .desconectado:
            EstadoConectar()
        case .foraDoPlano:
            EstadoForaDoPlano()
        case .indisponivel:
            EstadoIndisponivel()
        }
    }
}

private struct LivreConteudo: View {
    let l: LivreResumo
    let mostrar: Bool
    let atualizadoEm: Date
    let offline: Bool
    @Environment(\.colorScheme) private var esquema

    var body: some View {
        let escuro = esquema == .dark
        let cores = CoresMare(estado: l.estado, escuro: escuro)
        let icone = offline ? "wifi.slash" : (l.estado == "folgado" ? "checkmark.circle" : "exclamationmark.triangle")
        let status = offline ? "Atualizado às \(horaCurta(atualizadoEm))" : l.status
        ZStack(alignment: .topLeading) {
            GeometryReader { g in
                ZStack {
                    Mare(nivel: l.nivel, fase: -2, inverte: false).fill(cores.agua)
                    Mare(nivel: l.nivel, fase: 5, inverte: true).fill(cores.frente)
                    if l.estado != "vermelho" {
                        Path { p in
                            let y = g.size.height * CGFloat(1 - l.ritmo)
                            p.move(to: CGPoint(x: 0, y: y))
                            p.addLine(to: CGPoint(x: g.size.width, y: y))
                        }
                        .stroke(escuro ? Color.white.opacity(0.40) : Color.black.opacity(0.42),
                                style: StrokeStyle(lineWidth: 1.2, lineCap: .round, dash: [2, 4]))
                    }
                }
            }
            .opacity(offline ? 0.55 : 1)

            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("Livre hoje")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.secondary)
                    Spacer(minLength: 0)
                    MarcaSora(tamanho: 16)
                }
                HStack(alignment: .firstTextBaseline, spacing: 3) {
                    Text(l.prefixo)
                        .font(.system(size: 17, weight: .semibold))
                    Text(mostrar ? l.numero : "•••")
                        .font(.system(size: mostrar ? 46 : 34, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(0.5)
                        .widgetAccentable()
                    if !l.sufixo.isEmpty {
                        Text(l.sufixo)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                .padding(.top, 8)
                if !l.abaixo.isEmpty {
                    Text(l.abaixo)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .padding(.top, 4)
                }
                Spacer(minLength: 0)
                HStack(spacing: 5) {
                    Image(systemName: icone).font(.system(size: 11, weight: .bold))
                    Text(status).font(.system(size: 12, weight: .semibold)).lineLimit(1)
                }
                .foregroundStyle(offline ? Color.secondary : cores.status)
                Text(mostrar ? l.resto : l.resto_oculto)
                    .font(.system(size: 12, weight: .medium))
                    .monospacedDigit()
                    .foregroundStyle(offline ? Color.secondary : cores.texto)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .padding(.top, 3)
            }
            .padding(16)
        }
        .widgetURL(URL(string: "https://www.forsora.com/previstos"))
    }
}

// MARK: Próximas contas

struct ContasVista: View {
    let entrada: EntradaNumeros

    var body: some View {
        switch entrada.situacao {
        case .ok(let r, let em, let offline):
            if let c = r.contas {
                ContasConteudo(c: c, simbolo: r.simbolo ?? "R$", mostrar: entrada.mostrarValores, atualizadoEm: em, offline: offline)
            } else {
                EstadoIndisponivel()
            }
        case .desconectado:
            EstadoConectar()
        case .foraDoPlano:
            EstadoForaDoPlano()
        case .indisponivel:
            EstadoIndisponivel()
        }
    }
}

private func simboloDoIcone(_ icone: String) -> String {
    switch icone {
    case "luz": return "bolt"
    case "agua": return "drop"
    case "internet": return "wifi"
    case "casa": return "house"
    case "cartao": return "creditcard"
    case "divida": return "building.columns"
    case "agendado": return "calendar"
    default: return "arrow.triangle.2.circlepath"
    }
}

private func corDoIcone(_ icone: String, escuro: Bool) -> Color {
    switch icone {
    case "luz": return escuro ? Color(hex: 0xFFD24D) : Color(hex: 0x9A6200)
    case "agua", "internet", "agendado": return escuro ? Color(hex: 0x7DB8FF) : Color(hex: 0x0A64CF)
    case "cartao": return escuro ? Color(hex: 0xC4B5FD) : Color(hex: 0x6D28D9)
    case "divida": return escuro ? Color(hex: 0x3DD6C8) : Color(hex: 0x0F8A82)
    default: return escuro ? Color(hex: 0xD1D1D6) : Color(hex: 0x48484A)
    }
}

private func corDaOrigem(_ origem: String?, escuro: Bool) -> Color {
    switch origem {
    case "fatura": return escuro ? Color(hex: 0xC4B5FD) : Color(hex: 0x7C3AED)
    case "divida": return escuro ? Color(hex: 0x3DD6C8) : Color(hex: 0x0F8A82)
    case "fixa": return escuro ? Color(hex: 0xFFD24D) : Color(hex: 0xF2A900)
    case "agendado": return escuro ? Color(hex: 0x7DB8FF) : Color(hex: 0x0A64CF)
    default: return .clear
    }
}

private struct ContasConteudo: View {
    let c: ContasResumo
    let simbolo: String
    let mostrar: Bool
    let atualizadoEm: Date
    let offline: Bool
    @Environment(\.colorScheme) private var esquema

    var body: some View {
        let escuro = esquema == .dark
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 0) {
                Text(offline ? "Às \(horaCurta(atualizadoEm))" : "Próximos 7 dias")
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                HStack(alignment: .firstTextBaseline, spacing: 5) {
                    Text("\(c.quantidade)")
                        .font(.system(size: 38, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .widgetAccentable()
                    Text(c.rotulo)
                        .font(.system(size: 15, weight: .semibold))
                }
                .padding(.top, 6)
                Text(mostrar ? c.total_txt : "\(simbolo) ••••")
                    .font(.system(size: 13, weight: .semibold))
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .padding(.top, 5)
                Spacer(minLength: 0)
                HStack(spacing: 2) {
                    ForEach(Array(c.dias.enumerated()), id: \.offset) { _, d in
                        VStack(spacing: 4) {
                            Text(d.letra)
                                .font(.system(size: 10.5, weight: d.hoje ? .heavy : .semibold))
                                .foregroundStyle(d.hoje ? (escuro ? Color(hex: 0xB7F0C6) : Color(hex: 0x145C33)) : Color.secondary)
                                .frame(width: 13, height: 17)
                                .background(d.hoje ? verdeMarca.opacity(escuro ? 0.20 : 0.22) : Color.clear,
                                            in: RoundedRectangle(cornerRadius: 5, style: .continuous))
                            Circle()
                                .fill(corDaOrigem(d.origem, escuro: escuro))
                                .frame(width: 5, height: 5)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
            }
            .frame(width: 104)

            Rectangle()
                .fill(Color.primary.opacity(0.12))
                .frame(width: 1)

            if c.itens.isEmpty {
                VStack(spacing: 6) {
                    Image(systemName: "checkmark.circle")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(verdeMarca)
                    Text("Nada vence nos próximos 7 dias")
                        .font(.system(size: 13, weight: .semibold))
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(c.itens.enumerated()), id: \.offset) { i, item in
                        LinhaConta(item: item, simbolo: simbolo, mostrar: mostrar, escuro: escuro)
                        if i < c.itens.count - 1 { Spacer(minLength: 4) }
                    }
                    if c.mais > 0 {
                        Text("e mais \(c.mais)")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.secondary)
                            .padding(.top, 4)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(16)
        .widgetURL(URL(string: "https://www.forsora.com/previstos"))
    }
}

private struct LinhaConta: View {
    let item: ItemConta
    let simbolo: String
    let mostrar: Bool
    let escuro: Bool

    var body: some View {
        let cor = corDoIcone(item.icone, escuro: escuro)
        HStack(spacing: 9) {
            Image(systemName: simboloDoIcone(item.icone))
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(cor)
                .frame(width: 30, height: 30)
                .background(cor.opacity(0.14), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(item.titulo)
                        .font(.system(size: 13.5, weight: .semibold))
                        .lineLimit(1)
                    Spacer(minLength: 0)
                    Text(mostrar ? item.valor_txt : "\(simbolo) ••••")
                        .font(.system(size: 13.5, weight: .semibold))
                        .monospacedDigit()
                        .lineLimit(1)
                }
                HStack(spacing: 4) {
                    if item.atrasada {
                        Image(systemName: "exclamationmark.circle").font(.system(size: 10, weight: .bold))
                    }
                    Text(item.sub)
                        .font(.system(size: 11.5, weight: item.atrasada ? .semibold : .medium))
                        .lineLimit(1)
                }
                .foregroundStyle(item.atrasada ? vermelho(escuro) : Color.secondary)
            }
        }
    }
}

// MARK: Cartão

struct CartaoVista: View {
    let entrada: EntradaNumeros

    var body: some View {
        switch entrada.situacao {
        case .ok(let r, let em, let offline):
            let lista = r.cartoes ?? []
            if let c = lista.first(where: { $0.id == entrada.cartaoId }) ?? lista.first {
                CartaoConteudo(c: c, simbolo: r.simbolo ?? "R$", mostrar: entrada.mostrarValores, atualizadoEm: em, offline: offline)
            } else {
                EstadoMensagem(simbolo: "creditcard", titulo: "Nenhum cartão", texto: "Cadastre um cartão na ForSora.")
            }
        case .desconectado:
            EstadoConectar()
        case .foraDoPlano:
            EstadoForaDoPlano()
        case .indisponivel:
            EstadoIndisponivel()
        }
    }
}

private struct CartaoConteudo: View {
    let c: CartaoResumo
    let simbolo: String
    let mostrar: Bool
    let atualizadoEm: Date
    let offline: Bool
    @Environment(\.colorScheme) private var esquema

    var body: some View {
        let escuro = esquema == .dark
        let violeta = escuro ? Color(hex: 0xC4B5FD) : Color(hex: 0x6D28D9)
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 7) {
                Image(systemName: "creditcard")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(violeta)
                    .frame(width: 26, height: 26)
                    .background(violeta.opacity(0.14), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                Text(c.nome)
                    .font(.system(size: 13, weight: .semibold))
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            Text(offline ? "Às \(horaCurta(atualizadoEm))" : "Fatura atual")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.secondary)
            Text(mostrar ? c.valor_txt : "\(simbolo) ••••")
                .font(.system(size: 26, weight: .bold, design: .rounded))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .widgetAccentable()
            Text(c.sub)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .padding(.top, 2)
            if !c.atraso_txt.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: "exclamationmark.triangle").font(.system(size: 10, weight: .bold))
                    Text(mostrar ? c.atraso_txt : "Fatura em atraso")
                        .font(.system(size: 11.5, weight: .semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
                .foregroundStyle(vermelho(escuro))
                .padding(.top, 4)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(URL(string: "https://www.forsora.com/cartao-de-credito"))
    }
}

// MARK: Estados especiais (usados por todos os widgets, inclusive o Lançar)

struct MarcaSora: View {
    let tamanho: CGFloat

    var body: some View {
        let k = tamanho / 16
        ZStack {
            Circle().fill(verdeMarca)
            Path { p in
                p.move(to: CGPoint(x: 3.4 * k, y: 9.3 * k))
                p.addCurve(to: CGPoint(x: 6.85 * k, y: 9.3 * k),
                           control1: CGPoint(x: 4.55 * k, y: 7.95 * k), control2: CGPoint(x: 5.7 * k, y: 7.95 * k))
                p.addCurve(to: CGPoint(x: 10.3 * k, y: 9.3 * k),
                           control1: CGPoint(x: 8.0 * k, y: 10.65 * k), control2: CGPoint(x: 9.15 * k, y: 10.65 * k))
                p.addCurve(to: CGPoint(x: 12.05 * k, y: 8.25 * k),
                           control1: CGPoint(x: 10.9 * k, y: 8.6 * k), control2: CGPoint(x: 11.45 * k, y: 8.25 * k))
            }
            .stroke(Color(hex: 0x0B3D21), style: StrokeStyle(lineWidth: 1.6 * k, lineCap: .round))
        }
        .frame(width: tamanho, height: tamanho)
        .accessibilityHidden(true)
    }
}

struct EstadoConectar: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            MarcaSora(tamanho: 30)
            Text("Conecte o widget")
                .font(.system(size: 15, weight: .bold))
                .padding(.top, 12)
            Text("Toque para entrar na ForSora e conectar.")
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .padding(.top, 4)
            Spacer(minLength: 0)
            Text("Conectar")
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(Color(hex: 0x1F7A45))
                .padding(.horizontal, 11)
                .padding(.vertical, 6)
                .background(verdeMarca.opacity(0.20), in: Capsule())
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(URL(string: "https://www.forsora.com/widgets"))
    }
}

/// ⚠️ No iPhone nada se vende: sem preço, sem "assine", sem link pra planos.
struct EstadoForaDoPlano: View {
    var body: some View {
        EstadoMensagem(simbolo: "lock", titulo: "Fora do seu plano", texto: "Este recurso não está incluído no seu plano.")
    }
}

struct EstadoIndisponivel: View {
    var body: some View {
        EstadoMensagem(simbolo: "wifi.slash", titulo: "Sem dados agora", texto: "Abra a ForSora para atualizar.")
    }
}

struct EstadoMensagem: View {
    let simbolo: String
    let titulo: String
    let texto: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Image(systemName: simbolo)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(.secondary)
            Spacer(minLength: 0)
            Text(titulo)
                .font(.system(size: 15, weight: .bold))
            Text(texto)
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .padding(.top, 4)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

// MARK: Amostra (galeria de widgets e "carregando")

enum Amostra {
    static let resumo = ResumoWidget(
        estado: "ok", hoje: nil, simbolo: "R$",
        livre: LivreResumo(estado: "folgado", nivel: 0.45, ritmo: 0.36, prefixo: "R$", numero: "47", sufixo: "por dia",
                           abaixo: "", status: "No ritmo", resto: "R$ 612 até 30/11", resto_oculto: "R$ •••• até 30/11"),
        contas: ContasResumo(
            quantidade: 4, rotulo: "contas", total_txt: "R$ 1.322,30", atrasadas: 1,
            dias: [
                DiaResumo(letra: "T", hoje: true, origem: nil), DiaResumo(letra: "Q", hoje: false, origem: "fixa"),
                DiaResumo(letra: "Q", hoje: false, origem: nil), DiaResumo(letra: "S", hoje: false, origem: "fatura"),
                DiaResumo(letra: "S", hoje: false, origem: nil), DiaResumo(letra: "D", hoje: false, origem: "agendado"),
                DiaResumo(letra: "S", hoje: false, origem: nil),
            ],
            itens: [
                ItemConta(titulo: "Condomínio", sub: "Atrasada há 2 dias", valor_txt: "R$ 480,00", atrasada: true, icone: "casa", origem: "agendado"),
                ItemConta(titulo: "Luz", sub: "Amanhã", valor_txt: "R$ 182,40", atrasada: false, icone: "luz", origem: "fixa"),
                ItemConta(titulo: "Fatura Nubank", sub: "Sexta, 21", valor_txt: "R$ 524,90", atrasada: false, icone: "cartao", origem: "fatura"),
            ],
            mais: 1),
        cartoes: [CartaoResumo(id: "amostra", nome: "Nubank", valor_txt: "R$ 1.631,27", sub: "Fecha em 8 dias · vence 10/12", atraso_txt: "")]
    )

    static var situacao: SituacaoWidget { .ok(resumo, atualizadoEm: Date(), offline: false) }
}
