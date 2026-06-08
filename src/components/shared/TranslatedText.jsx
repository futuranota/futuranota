import { useTranslatedText } from "../../hooks/useTranslatedText.js";

/** Renders dynamic text translated when locale !== en. */
export function TranslatedText({ text, as: Tag = "span", className, title, ...rest }) {
  const label = useTranslatedText(text);
  return (
    <Tag className={className} title={title ?? label} {...rest}>
      {label}
    </Tag>
  );
}
