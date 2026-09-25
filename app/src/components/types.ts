export interface Model {
  id: string;
  name: string;
  creator: string;
  logo: string | null;
  layer: number;
  hasData: boolean; // tiene calidad y precio: puede ir al gráfico
  quality: number | null; // índice de inteligencia de Artificial Analysis
  price: number | null; // USD por millón de tokens, combinado 3:1
  speed: number | null; // tokens por segundo
  url: string;
  task: string | null;
}

export type Status = 'idle' | 'classifying' | 'done' | 'partial' | 'error';
