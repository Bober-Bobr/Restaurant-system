import { useId, type CSSProperties, type ReactNode } from 'react';

/**
 * A file picker that looks like the rest of the app.
 *
 * A bare `<input type="file">` is drawn by the browser, not by us: on a Russian
 * Chrome it reads "Обзор…" in the system font next to a grey box, which is why
 * it stood out against every styled control around it. There is no way to
 * restyle that button, so the input is hidden and a `<label>` bound to it is
 * styled instead — clicking the label opens the picker exactly as clicking the
 * button did.
 *
 * The input is visually hidden rather than `display: none`, because `display:
 * none` also removes it from the focus order: the control would be unreachable
 * by keyboard entirely. Kept in the tree, it still takes focus, and the styles
 * hang a focus ring off `:focus-within` on the label.
 */
export function FilePickButton({
  accept,
  multiple = false,
  disabled = false,
  onPick,
  children,
  className = 'adm-filepick',
  style,
}: {
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Receives the picked files; the input is cleared afterwards by this component. */
  onPick: (files: FileList | null) => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={className}
      style={{ ...style, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1 }}
      data-disabled={disabled || undefined}
    >
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          onPick(e.target.files);
          // Clearing lets the same file be picked again after a removal —
          // otherwise the change event never fires a second time for it.
          e.target.value = '';
        }}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          clipPath: 'inset(50%)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      />
      {children}
    </label>
  );
}
