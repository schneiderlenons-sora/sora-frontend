import Foundation

// MARK: - O retrato que o servidor manda (GET /api/widget/resumo)
//
// O TEXTO JÁ VEM PRONTO ("R$ 47", "Amanhã", "Atrasada há 2 dias"): o widget só
// desenha. A regra mora no servidor (sora-backend/src/services/widgetResumo.js)
// pra o iPhone e o Android nunca discordarem.

struct ResumoWidget: Codable {
    let estado: String?
    let hoje: String?
    let simbolo: String?
    let livre: LivreResumo?
    let contas: ContasResumo?
    let cartoes: [CartaoResumo]?
}

struct LivreResumo: Codable {
    let estado: String
    let nivel: Double
    let ritmo: Double
    let prefixo: String
    let numero: String
    let sufixo: String
    let abaixo: String
    let status: String
    let resto: String
    let resto_oculto: String
}

struct ContasResumo: Codable {
    let quantidade: Int
    let rotulo: String
    let total_txt: String
    let atrasadas: Int
    let dias: [DiaResumo]
    let itens: [ItemConta]
    let mais: Int
}

struct DiaResumo: Codable {
    let letra: String
    let hoje: Bool
    let origem: String?
}

struct ItemConta: Codable {
    let titulo: String
    let sub: String
    let valor_txt: String
    let atrasada: Bool
    let icone: String
    let origem: String
}

struct CartaoResumo: Codable {
    let id: String
    let nome: String
    let valor_txt: String
    let sub: String
    let atraso_txt: String
}

/// O que o widget consegue mostrar agora.
enum SituacaoWidget {
    /// Conectado e com retrato (`offline` = é o último guardado, sem internet agora).
    case ok(ResumoWidget, atualizadoEm: Date, offline: Bool)
    /// Sem chave no aparelho, ou a chave foi desconectada.
    case desconectado
    /// A conta não tem os widgets no plano (ou o teste está fechado).
    case foraDoPlano
    /// Nunca conseguiu buscar e não há nada guardado.
    case indisponivel
}

// MARK: - Busca e cache

enum ServicoResumo {
    private static let padrao = UserDefaults.standard
    private static let kCorpo = "sora.resumo.corpo"
    private static let kEtag = "sora.resumo.etag"
    private static let kEm = "sora.resumo.em"

    /// O último retrato guardado neste aparelho (pra mostrar sem internet).
    static func guardado() -> (ResumoWidget, Date)? {
        guard let dados = padrao.data(forKey: kCorpo),
              let r = try? JSONDecoder().decode(ResumoWidget.self, from: dados) else { return nil }
        let em = padrao.object(forKey: kEm) as? Date ?? Date.distantPast
        return (r, em)
    }

    private static func guardar(_ dados: Data, etag: String?) {
        padrao.set(dados, forKey: kCorpo)
        padrao.set(etag, forKey: kEtag)
        padrao.set(Date(), forKey: kEm)
    }

    private static func esquecer() {
        padrao.removeObject(forKey: kCorpo)
        padrao.removeObject(forKey: kEtag)
        padrao.removeObject(forKey: kEm)
    }

    /// Busca o retrato. Barato de propósito: manda o ETag do último retrato e,
    /// se nada mudou, o servidor responde 304 sem corpo (uma ida ao banco).
    static func buscar() async -> SituacaoWidget {
        guard let chave = ChaveWidget.chave else {
            esquecer()
            return .desconectado
        }
        guard let url = URL(string: "\(ChaveWidget.api)/api/widget/resumo") else { return .indisponivel }
        var pedido = URLRequest(url: url)
        pedido.timeoutInterval = 15
        pedido.setValue("Bearer \(chave)", forHTTPHeaderField: "Authorization")
        if guardado() != nil, let etag = padrao.string(forKey: kEtag) {
            pedido.setValue(etag, forHTTPHeaderField: "If-None-Match")
        }

        do {
            let (dados, resposta) = try await URLSession.shared.data(for: pedido)
            let status = (resposta as? HTTPURLResponse)?.statusCode ?? 0
            if status == 304, let ultimo = guardado() {
                padrao.set(Date(), forKey: kEm)
                return .ok(ultimo.0, atualizadoEm: Date(), offline: false)
            }
            if status == 401 {
                esquecer()
                return .desconectado
            }
            guard status == 200, let r = try? JSONDecoder().decode(ResumoWidget.self, from: dados) else {
                return deGuardado()
            }
            if r.estado == "plano" || r.estado == "teste" || r.estado == "desligado" {
                esquecer()
                return .foraDoPlano
            }
            guard r.estado == "ok" else { return deGuardado() }
            let etag = (resposta as? HTTPURLResponse)?.value(forHTTPHeaderField: "ETag")
            guardar(dados, etag: etag)
            return .ok(r, atualizadoEm: Date(), offline: false)
        } catch {
            return deGuardado()
        }
    }

    /// Sem internet ou servidor fora: o último retrato, marcado como antigo.
    private static func deGuardado() -> SituacaoWidget {
        if let ultimo = guardado() { return .ok(ultimo.0, atualizadoEm: ultimo.1, offline: true) }
        return .indisponivel
    }
}
