export function isUnmodifiedPrimaryActivation(event) {
  const target = event.currentTarget;
  const linkTarget = target.getAttribute('target');

  return (
    !event.defaultPrevented
    && event.button === 0
    && (!linkTarget || linkTarget === '_self')
    && !target.hasAttribute('download')
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey
  );
}
