// Corre sola una vez por día (Netlify "scheduled function"): guarda una copia de los productos.
import { almacen } from './_lib/almacen.mjs';
import { hacerRespaldo } from './_lib/respaldo.mjs';

export default async () => { console.log('respaldo', JSON.stringify(await hacerRespaldo(await almacen()))); };
export const config = { schedule: '@daily' };
