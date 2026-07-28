interface ProductStoryProps {
  story?: string | null
  dict: any
}

export default function ProductStory({ story, dict }: ProductStoryProps) {
  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-light text-stone-900 mb-6 tracking-tight">
        {dict.story}
      </h2>
      {story ? (
        <div className="prose prose-stone prose-sm max-w-none">
          <p className="text-stone-600 leading-relaxed whitespace-pre-line">
            {story}
          </p>
        </div>
      ) : (
        <div className="border border-dashed border-stone-200 rounded-2xl px-8 py-12 text-center">
          <p className="text-stone-400 text-sm leading-relaxed italic">
            {dict.storyPlaceholder}
          </p>
        </div>
      )}
    </div>
  )
}