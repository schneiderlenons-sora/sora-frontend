import WidgetKit
import SwiftUI

/// Os widgets da ForSora no iPhone.
///
/// Fase 2: os widgets com números leem o retrato da conta (ServicoResumo), com a
/// chave que o app guarda no Keychain compartilhado (ChaveWidget). O "Hoje"
/// (agenda, tarefas e hábitos) entra na fase 3.
@main
struct SoraWidgetsBundle: WidgetBundle {
    var body: some Widget {
        LivreWidget()
        ContasWidget()
        CartaoWidget()
        LancarWidget()
    }
}
