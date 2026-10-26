import { registerRootComponent } from 'expo';

import App from './App';
import { aplicarLimiteDeFuente } from './src/utils/textoGlobal';

// Los textos del sistema no crecen más de 1,3x con el tamaño de letra del teléfono (evita desbordes)
aplicarLimiteDeFuente();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
