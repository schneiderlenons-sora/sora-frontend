import WidgetKit
import SwiftUI

/// Os widgets da ForSora no iPhone.
///
/// Fase 1: só o "Lançar rápido", que não precisa de login nem de dados.
/// Os widgets com números (Livre pra gastar, Próximas contas, Hoje) entram na
/// fase 2, junto com a conexão do widget à conta.
@main
struct SoraWidgetsBundle: WidgetBundle {
    var body: some Widget {
        LancarWidget()
    }
}
