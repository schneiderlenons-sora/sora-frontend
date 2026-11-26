import UIKit
import Capacitor

// A tela do app (a mesma CAPBridgeViewController de antes) com o plugin de
// compras registrado. Plugin feito dentro do projeto não é achado sozinho pelo
// Capacitor — precisa ser registrado aqui (doc do Capacitor: "custom native
// iOS code"). O SceneDelegate e o Main.storyboard apontam pra esta classe.
class SoraViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SoraComprasPlugin())
        bridge?.registerPluginInstance(SoraWidgetPlugin())
    }
}
