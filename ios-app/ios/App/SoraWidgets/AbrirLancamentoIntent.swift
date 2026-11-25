import AppIntents
#if MAIN_APP
import UIKit
#endif

/// A ação dos botões do widget "Lançar rápido".
///
/// ⚠️ ESTE ARQUIVO ENTRA NOS DOIS ALVOS (app E widget). É o que faz o toque
/// abrir a ForSora: com `openAppWhenRun`, o iPhone abre o app e roda o
/// `perform()` DENTRO DELE — e lá a ForSora troca pela conversa no WhatsApp.
/// No widget o corpo fica vazio: extensão não pode abrir outro app (`UIApplication`
/// nem existe lá). Quem separa os dois é a condição `MAIN_APP`, ligada só no
/// alvo do app (SWIFT_ACTIVE_COMPILATION_CONDITIONS no project.pbxproj).
///
/// ⚠️ A 1ª versão usava `Button(intent: OpenURLIntent(url))` direto: no iPhone o
/// toque não fazia NADA (build 6, 25/11/2026).
@available(iOS 16.0, *)
struct AbrirLancamentoIntent: AppIntent {
    static var title: LocalizedStringResource = "Lançar na ForSora"
    static var description = IntentDescription("Abre a conversa com a Sora no WhatsApp.")
    static var openAppWhenRun: Bool = true
    static var isDiscoverable: Bool = false

    /// gasto, receita, audio ou foto.
    @Parameter(title: "Ação")
    var acao: String

    init() {}

    init(acao: String) {
        self.acao = acao
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        #if MAIN_APP
        if let destino = AtalhoLancar.whatsapp(acao: acao) {
            AtalhoLancar.abrir(destino)
        }
        #endif
        return .result()
    }
}
