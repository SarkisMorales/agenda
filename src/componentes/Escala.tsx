interface Props {
  titulo: string;
  ayuda: string;
  valor: number;
  onElegir: (n: number) => void;
}

/** Los cinco botones del 1 al 5. Grandes: en el celular se usan con el pulgar. */
export function Escala({ titulo, ayuda, valor, onElegir }: Props) {
  return (
    <div className="escala">
      <div className="escala-titulo">
        <b>{titulo}</b>
        <small>{ayuda}</small>
      </div>
      <div className="escala-botones">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={valor === n}
            aria-label={`${titulo} ${n}`}
            onClick={() => onElegir(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
