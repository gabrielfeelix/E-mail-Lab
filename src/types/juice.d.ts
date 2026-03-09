declare module 'juice/client' {
  type JuiceOptions = {
    applyStyleTags?: boolean
    inlinePseudoElements?: boolean
    preserveFontFaces?: boolean
    preserveImportant?: boolean
    preserveMediaQueries?: boolean
    removeStyleTags?: boolean
  }

  interface JuiceClient {
    (html: string, options?: JuiceOptions): string
    inlineContent: (html: string, css: string, options?: JuiceOptions) => string
  }

  const juiceClient: JuiceClient
  export default juiceClient
}
