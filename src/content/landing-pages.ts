// ──────────────────────────────────────────────────────────
// Landing page content — Botanical Jewellery + Orchid Jewellery
// PT-PT is the canonical editorial source.
// ──────────────────────────────────────────────────────────

export const landingSlugs = {
  botanical: {
    pt: 'joias-botanicas',
    en: 'botanical-jewellery',
    es: 'joyeria-botanica',
    it: 'gioielli-botanici',
    de: 'botanischer-schmuck',
  } as Record<string, string>,
  orchid: {
    pt: 'joias-com-orquideas',
    en: 'orchid-jewellery',
    es: 'joyas-con-orquideas',
    it: 'gioielli-con-orchidee',
    de: 'orchideen-schmuck',
  } as Record<string, string>,
} as const

export type LandingType = keyof typeof landingSlugs

/** Reverse-lookup: given a locale + slug, return the landing type or null */
export function resolveLanding(locale: string, slug: string): LandingType | null {
  for (const type of Object.keys(landingSlugs) as LandingType[]) {
    if (landingSlugs[type][locale] === slug) return type
  }
  return null
}

/** Build the set of all known slugs for quick 404 checks */
export function allKnownSlugs(): Set<string> {
  const slugs = new Set<string>()
  for (const type of Object.keys(landingSlugs) as LandingType[]) {
    for (const locale of Object.keys(landingSlugs[type])) {
      slugs.add(landingSlugs[type][locale])
    }
  }
  return slugs
}

// ── Section / paragraph data ─────────────────────────────

export interface LandingContent {
  meta: {
    title: string
    description: string
    ogTitle: string
    ogDescription: string
  }
  h1: string
  intro: string
  sections: Array<{
    heading: string
    body: string[]
  }>
  faq: Array<{
    q: string
    a: string
  }>
  ctaHeading: string
  ctaText: string
}

export const botanicalContent: Record<string, LandingContent> = {
  pt: {
    meta: {
      title: 'Joias Botânicas com Flores Naturais | Eternal Flowers',
      description:
        'Joias botânicas artesanais com flores verdadeiras, preservadas em resina. Peças únicas feitas à mão em Braga pela Marina. Brincos, colares e pingentes com flores naturais.',
      ogTitle: 'Joias Botânicas com Flores Naturais | Eternal Flowers',
      ogDescription:
        'Joias botânicas artesanais com flores verdadeiras, preservadas em resina. Peças únicas feitas à mão em Braga pela Marina.',
    },
    h1: 'Joias Botânicas com Flores Naturais',
    intro:
      'Na Eternal Flowers, cada joia botânica nasce de uma flor verdadeira. Preservamos a beleza natural das flores em resina para criar peças únicas, feitas à mão em Braga, Portugal. Brincos, colares, pulseiras e pingentes que transformam flores reais em memórias que o tempo não apaga.',
    sections: [
      {
        heading: 'O Que São Joias Botânicas?',
        body: [
          'Joias botânicas são criações artesanais que incorporam elementos naturais — flores verdadeiras, folhas e pétalas — transformando-os em peças de joalharia. Diferente das joias convencionais, cada peça botânica carrega consigo a história de uma flor real, preservada para durar.',
          'Na Eternal Flowers, usamos exclusivamente flores naturais. As pétalas, as formas e as cores de cada flor são mantidas através de um processo artesanal de preservação em resina, que protege a flor sem perder a sua autenticidade.',
        ],
      },
      {
        heading: 'Flores Verdadeiras Preservadas em Resina',
        body: [
          'Sim, as flores são verdadeiras. Não usamos flores artificiais nem imitações. Cada peça começa com uma flor real — orquídeas, rosas e outras variedades — que é cuidadosamente selecionada e preservada em resina.',
          'A resina transparente envolve cada flor, mantendo a sua forma, textura e cor. Este processo permite que a beleza natural da flor seja apreciada ao longo do tempo, transformando algo efémero numa joia duradoura.',
        ],
      },
      {
        heading: 'Feitas à Mão pela Marina, em Braga',
        body: [
          'Cada peça é criada à mão pela Marina, no atelier da Eternal Flowers em Braga, Portugal. Não há produção em série. A Marina seleciona pessoalmente cada flor e trabalha cada detalhe com a atenção de quem conhece o valor do que é feito devagar.',
          'Este cuidado artesanal significa que cada joia botânica recebe atenção individual, desde a escolha da flor até ao acabamento final da resina.',
        ],
      },
      {
        heading: 'Cada Flor Torna a Peça Diferente',
        body: [
          'Por usarmos flores naturais, cada peça tem as suas próprias características — a posição das pétalas, os tons de cor, a forma da flor. Esta variação natural é parte do que torna cada criação especial.',
          'Ao escolher uma joia botânica da Eternal Flowers, leva consigo uma flor que existiu, foi escolhida e transformada numa peça que pode guardar para sempre.',
        ],
      },
      {
        heading: 'Tipos de Peças',
        body: [
          'Trabalhamos vários tipos de joias botânicas para que encontre a peça ideal: brincos, colares, pulseiras e pingentes com flores naturais preservadas. Cada tipo de peça permite uma forma diferente de usar e mostrar a beleza das flores.',
          'Convidamo-lo a explorar o catálogo para descobrir as peças disponíveis e encontrar a que mais combina consigo.',
        ],
      },
      {
        heading: 'Personalização',
        body: [
          'Cada peça pode ser personalizada para si. A Eternal Flowers valoriza o contacto direto com cada cliente, e a personalização faz parte da experiência. Se tem uma flor favorita ou uma ideia em mente, a Marina pode criar uma peça pensada especialmente para si.',
          'Entre em contacto para conversarmos sobre a sua joia botânica ideal.',
        ],
      },
    ],
    faq: [
      {
        q: 'As flores são mesmo verdadeiras?',
        a: 'Sim, todas as joias botânicas da Eternal Flowers são feitas com flores verdadeiras. Não utilizamos flores artificiais. Cada peça começa com uma flor real que é preservada em resina.',
      },
      {
        q: 'Como é que as flores entram nas peças?',
        a: 'As flores são cuidadosamente selecionadas e preservadas através de um processo artesanal em resina. A resina envolve a flor, mantendo a sua forma e cor naturais.',
      },
      {
        q: 'Quem cria as peças?',
        a: 'Todas as peças são criadas à mão pela Marina, no atelier em Braga, Portugal.',
      },
      {
        q: 'Onde são feitas as joias botânicas?',
        a: 'As joias são feitas à mão em Braga, Portugal, no atelier da Eternal Flowers.',
      },
      {
        q: 'É possível personalizar uma peça?',
        a: 'Sim. A Eternal Flowers valoriza o contacto direto com cada cliente. Fale connosco para sabermos o que tem em mente.',
      },
      {
        q: 'Que tipos de joias botânicas existem?',
        a: 'Trabalhamos brincos, colares, pulseiras, pingentes e conjuntos com flores naturais preservadas. Consulte o catálogo para ver as peças disponíveis.',
      },
      {
        q: 'Como posso ver as peças disponíveis?',
        a: 'Explore o nosso catálogo online para descobrir as joias botânicas disponíveis neste momento.',
      },
    ],
    ctaHeading: 'Descobrir as Joias Botânicas',
    ctaText: 'Ver Catálogo',
  },

  en: {
    meta: {
      title: 'Botanical Jewellery with Real Flowers | Eternal Flowers',
      description:
        'Handmade botanical jewellery with real flowers, preserved in resin. Unique pieces handcrafted in Braga, Portugal by Marina. Earrings, necklaces and pendants with natural flowers.',
      ogTitle: 'Botanical Jewellery with Real Flowers | Eternal Flowers',
      ogDescription:
        'Handmade botanical jewellery with real flowers, preserved in resin. Unique pieces handcrafted in Braga, Portugal by Marina.',
    },
    h1: 'Botanical Jewellery with Real Flowers',
    intro:
      'At Eternal Flowers, every piece of botanical jewellery begins with a real flower. We preserve natural beauty in resin to create unique pieces, handmade in Braga, Portugal. Earrings, necklaces, bracelets and pendants that turn real flowers into timeless keepsakes.',
    sections: [
      {
        heading: 'What Is Botanical Jewellery?',
        body: [
          'Botanical jewellery is handcrafted work that incorporates natural elements — real flowers, leaves and petals — transforming them into wearable pieces. Unlike conventional jewellery, each botanical piece carries the story of a real flower, preserved to last.',
          'At Eternal Flowers we use only natural flowers. The petals, shapes and colours of each flower are preserved through a handcrafted resin process that protects the flower while keeping its authenticity.',
        ],
      },
      {
        heading: 'Real Flowers Preserved in Resin',
        body: [
          'Yes, the flowers are real. We do not use artificial flowers or imitations. Each piece begins with a real flower — orchids, roses and other varieties — carefully selected and preserved in resin.',
          'The clear resin encases each flower, maintaining its shape, texture and colour. This process lets the natural beauty of the flower be enjoyed over time, turning something ephemeral into lasting jewellery.',
        ],
      },
      {
        heading: 'Handmade by Marina in Braga',
        body: [
          'Every piece is handcrafted by Marina at the Eternal Flowers atelier in Braga, Portugal. There is no mass production. Marina personally selects each flower and attends to every detail with the care that comes from knowing the value of slow, deliberate work.',
          'This handmade approach means each piece of botanical jewellery receives individual attention, from the choice of flower to the final resin finish.',
        ],
      },
      {
        heading: 'Each Flower Makes the Piece Unique',
        body: [
          'Because we use natural flowers, each piece has its own character — the position of the petals, the shades of colour, the shape of the flower. This natural variation is part of what makes each creation special.',
          'When you choose a piece of botanical jewellery from Eternal Flowers, you take home a flower that once existed, was carefully selected, and transformed into something you can keep forever.',
        ],
      },
      {
        heading: 'Types of Pieces',
        body: [
          'We work with several types of botanical jewellery so you can find the perfect piece: earrings, necklaces, bracelets and pendants with preserved natural flowers. Each type offers a different way to wear and showcase the beauty of flowers.',
          'We invite you to explore the catalogue to discover currently available pieces and find the one that suits you best.',
        ],
      },
      {
        heading: 'Personalisation',
        body: [
          'Every piece can be personalised for you. Eternal Flowers values direct contact with each customer, and personalisation is part of the experience. If you have a favourite flower or an idea in mind, Marina can create a piece designed especially for you.',
          'Get in touch so we can talk about your ideal botanical jewellery piece.',
        ],
      },
    ],
    faq: [
      {
        q: 'Are the flowers really real?',
        a: 'Yes, all Eternal Flowers botanical jewellery is made with real flowers. We do not use artificial flowers. Each piece starts with a real flower that is preserved in resin.',
      },
      {
        q: 'How are the flowers incorporated into the pieces?',
        a: 'The flowers are carefully selected and preserved through a handcrafted resin process. The resin encases the flower, maintaining its natural shape and colour.',
      },
      {
        q: 'Who creates the pieces?',
        a: 'All pieces are handcrafted by Marina at the atelier in Braga, Portugal.',
      },
      {
        q: 'Where is the jewellery made?',
        a: 'All pieces are handmade in Braga, Portugal, at the Eternal Flowers atelier.',
      },
      {
        q: 'Can I personalise a piece?',
        a: 'Yes. Eternal Flowers values direct contact with each customer. Get in touch and tell us what you have in mind.',
      },
      {
        q: 'What types of botanical jewellery are available?',
        a: 'We create earrings, necklaces, bracelets, pendants and sets with preserved natural flowers. Browse the catalogue to see current pieces.',
      },
      {
        q: 'How can I see the available pieces?',
        a: 'Explore our online catalogue to discover the botanical jewellery currently available.',
      },
    ],
    ctaHeading: 'Discover Botanical Jewellery',
    ctaText: 'View Catalogue',
  },

  es: {
    meta: {
      title: 'Joyería Botánica con Flores Naturales | Eternal Flowers',
      description:
        'Joyas botánicas artesanales con flores verdaderas, preservadas en resina. Piezas únicas hechas a mano en Braga, Portugal por Marina. Pendientes, collares y colgantes con flores naturales.',
      ogTitle: 'Joyería Botánica con Flores Naturales | Eternal Flowers',
      ogDescription:
        'Joyas botánicas artesanales con flores verdaderas, preservadas en resina. Piezas únicas hechas a mano en Braga, Portugal por Marina.',
    },
    h1: 'Joyería Botánica con Flores Naturales',
    intro:
      'En Eternal Flowers, cada joya botánica nace de una flor verdadera. Preservamos la belleza natural de las flores en resina para crear piezas únicas, hechas a mano en Braga, Portugal. Pendientes, collares, pulseras y colgantes que convierten flores reales en recuerdos eternos.',
    sections: [
      {
        heading: '¿Qué Es la Joyería Botánica?',
        body: [
          'La joyería botánica son creaciones artesanales que incorporan elementos naturales — flores verdaderas, hojas y pétalos — transformándolos en piezas de joyería. A diferencia de las joyas convencionales, cada pieza botánica lleva consigo la historia de una flor real, preservada para durar.',
          'En Eternal Flowers usamos exclusivamente flores naturales. Los pétalos, formas y colores de cada flor se mantienen mediante un proceso artesanal de preservación en resina que protege la flor sin perder su autenticidad.',
        ],
      },
      {
        heading: 'Flores Verdaderas Preservadas en Resina',
        body: [
          'Sí, las flores son verdaderas. No usamos flores artificiales ni imitaciones. Cada pieza comienza con una flor real — orquídeas, rosas y otras variedades — cuidadosamente seleccionada y preservada en resina.',
          'La resina transparente envuelve cada flor, manteniendo su forma, textura y color. Este proceso permite que la belleza natural de la flor se aprecie con el tiempo, transformando algo efímero en una joya duradera.',
        ],
      },
      {
        heading: 'Hechas a Mano por Marina en Braga',
        body: [
          'Cada pieza es creada a mano por Marina, en el taller de Eternal Flowers en Braga, Portugal. No hay producción en serie. Marina selecciona personalmente cada flor y trabaja cada detalle con la atención de quien conoce el valor de lo hecho despacio.',
          'Este cuidado artesanal significa que cada joya botánica recibe atención individual, desde la elección de la flor hasta el acabado final de la resina.',
        ],
      },
      {
        heading: 'Cada Flor Hace la Pieza Diferente',
        body: [
          'Al usar flores naturales, cada pieza tiene sus propias características: la posición de los pétalos, los tonos de color, la forma de la flor. Esta variación natural es parte de lo que hace especial cada creación.',
          'Al elegir una joya botánica de Eternal Flowers, lleva consigo una flor que existió, fue elegida y transformada en una pieza que puede guardar para siempre.',
        ],
      },
      {
        heading: 'Tipos de Piezas',
        body: [
          'Trabajamos varios tipos de joyas botánicas para que encuentre la pieza ideal: pendientes, collares, pulseras y colgantes con flores naturales preservadas. Cada tipo de pieza permite una forma diferente de lucir la belleza de las flores.',
          'Le invitamos a explorar el catálogo para descubrir las piezas disponibles y encontrar la que más le guste.',
        ],
      },
      {
        heading: 'Personalización',
        body: [
          'Cada pieza puede personalizarse para usted. Eternal Flowers valora el contacto directo con cada cliente, y la personalización forma parte de la experiencia. Si tiene una flor favorita o una idea en mente, Marina puede crear una pieza pensada especialmente para usted.',
          'Póngase en contacto para hablar sobre su joya botánica ideal.',
        ],
      },
    ],
    faq: [
      {
        q: '¿Las flores son realmente verdaderas?',
        a: 'Sí, todas las joyas botánicas de Eternal Flowers están hechas con flores verdaderas. No utilizamos flores artificiales. Cada pieza comienza con una flor real preservada en resina.',
      },
      {
        q: '¿Cómo se incorporan las flores en las piezas?',
        a: 'Las flores se seleccionan cuidadosamente y se preservan mediante un proceso artesanal en resina. La resina envuelve la flor, manteniendo su forma y color naturales.',
      },
      {
        q: '¿Quién crea las piezas?',
        a: 'Todas las piezas son creadas a mano por Marina en el taller de Braga, Portugal.',
      },
      {
        q: '¿Dónde se hacen las joyas?',
        a: 'Todas las piezas se hacen a mano en Braga, Portugal, en el taller de Eternal Flowers.',
      },
      {
        q: '¿Se puede personalizar una pieza?',
        a: 'Sí. Eternal Flowers valora el contacto directo con cada cliente. Contáctenos para contarnos lo que tiene en mente.',
      },
      {
        q: '¿Qué tipos de joyería botánica ofrecen?',
        a: 'Creamos pendientes, collares, pulseras, colgantes y juegos con flores naturales preservadas. Consulte el catálogo para ver las piezas actuales.',
      },
      {
        q: '¿Cómo puedo ver las piezas disponibles?',
        a: 'Explore nuestro catálogo en línea para descubrir las joyas botánicas disponibles actualmente.',
      },
    ],
    ctaHeading: 'Descubrir la Joyería Botánica',
    ctaText: 'Ver Catálogo',
  },

  it: {
    meta: {
      title: 'Gioielli Botanici con Fiori Naturali | Eternal Flowers',
      description:
        'Gioielli botanici artigianali con fiori veri, preservati nella resina. Pezzi unici fatti a mano a Braga, Portogallo da Marina. Orecchini, collane e pendenti con fiori naturali.',
      ogTitle: 'Gioielli Botanici con Fiori Naturali | Eternal Flowers',
      ogDescription:
        'Gioielli botanici artigianali con fiori veri, preservati nella resina. Pezzi unici fatti a mano a Braga, Portogallo da Marina.',
    },
    h1: 'Gioielli Botanici con Fiori Naturali',
    intro:
      'Da Eternal Flowers, ogni gioiello botanico nasce da un fiore vero. Preserviamo la bellezza naturale dei fiori nella resina per creare pezzi unici, fatti a mano a Braga, Portogallo. Orecchini, collane, bracciali e pendenti che trasformano fiori veri in ricordi senza tempo.',
    sections: [
      {
        heading: 'Cosa Sono i Gioielli Botanici?',
        body: [
          'I gioielli botanici sono creazioni artigianali che incorporano elementi naturali — fiori veri, foglie e petali — trasformandoli in preziosi. Diversamente dai gioielli convenzionali, ogni pezzo botanico porta con sé la storia di un fiore vero, preservato per durare.',
          'Da Eternal Flowers usiamo esclusivamente fiori naturali. I petali, le forme e i colori di ogni fiore sono mantenuti attraverso un processo artigianale di preservazione nella resina che protegge il fiore senza perderne lautenticità.',
        ],
      },
      {
        heading: 'Fiori Veri Preservati nella Resina',
        body: [
          'Sì, i fiori sono veri. Non usiamo fiori artificiali né imitazioni. Ogni pezzo inizia con un fiore vero — orchidee, rose e altre varietà — accuratamente selezionato e preservato nella resina.',
          'La resina trasparente avvolge ogni fiore, mantenendo la sua forma, consistenza e colore. Questo processo permette di apprezzare la bellezza naturale del fiore nel tempo, trasformando qualcosa di effimero in un gioiello duraturo.',
        ],
      },
      {
        heading: 'Fatti a Mano da Marina a Braga',
        body: [
          'Ogni pezzo è creato a mano da Marina, nellatelier di Eternal Flowers a Braga, Portogallo. Non cè produzione in serie. Marina seleziona personalmente ogni fiore e cura ogni dettaglio con lattenzione di chi conosce il valore del lavoro lento.',
          'Questa cura artigianale significa che ogni gioiello botanico riceve attenzione individuale, dalla scelta del fiore alla finitura finale della resina.',
        ],
      },
      {
        heading: 'Ogni Fiore Rende il Pezzo Diverso',
        body: [
          'Usando fiori naturali, ogni pezzo ha le sue caratteristiche: la posizione dei petali, le sfumature di colore, la forma del fiore. Questa variazione naturale è parte di ciò che rende speciale ogni creazione.',
          'Scegliendo un gioiello botanico di Eternal Flowers, porta con sé un fiore che è esistito, è stato scelto e trasformato in un pezzo che può custodire per sempre.',
        ],
      },
      {
        heading: 'Tipi di Pezzi',
        body: [
          'Realizziamo vari tipi di gioielli botanici per farvi trovare il pezzo ideale: orecchini, collane, bracciali e pendenti con fiori naturali preservati. Ogni tipo offre un modo diverso di indossare e mostrare la bellezza dei fiori.',
          'Vi invitiamo a esplorare il catalogo per scoprire i pezzi disponibili e trovare quello che fa per voi.',
        ],
      },
      {
        heading: 'Personalizzazione',
        body: [
          'Ogni pezzo può essere personalizzato per voi. Eternal Flowers valorizza il contatto diretto con ogni cliente e la personalizzazione fa parte dellesperienza. Se avete un fiore preferito o unidea in mente, Marina può creare un pezzo pensato appositamente per voi.',
          'Contattateci per parlare del vostro gioiello botanico ideale.',
        ],
      },
    ],
    faq: [
      {
        q: 'I fiori sono davvero veri?',
        a: 'Sì, tutti i gioielli botanici di Eternal Flowers sono realizzati con fiori veri. Non utilizziamo fiori artificiali. Ogni pezzo inizia con un fiore vero preservato nella resina.',
      },
      {
        q: 'Come vengono incorporati i fiori nei pezzi?',
        a: 'I fiori vengono accuratamente selezionati e preservati attraverso un processo artigianale nella resina. La resina avvolge il fiore, mantenendo la sua forma e colore naturali.',
      },
      {
        q: 'Chi crea i pezzi?',
        a: 'Tutti i pezzi sono creati a mano da Marina nellatelier di Braga, Portogallo.',
      },
      {
        q: 'Dove vengono realizzati i gioielli?',
        a: 'Tutti i pezzi sono fatti a mano a Braga, Portogallo, nellatelier di Eternal Flowers.',
      },
      {
        q: 'È possibile personalizzare un pezzo?',
        a: 'Sì. Eternal Flowers valorizza il contatto diretto con ogni cliente. Contattateci per raccontarci cosa avete in mente.',
      },
      {
        q: 'Quali tipi di gioielli botanici offrite?',
        a: 'Creiamo orecchini, collane, bracciali, pendenti e set con fiori naturali preservati. Consultate il catalogo per vedere i pezzi attuali.',
      },
      {
        q: 'Come posso vedere i pezzi disponibili?',
        a: 'Esplorate il nostro catalogo online per scoprire i gioielli botanici attualmente disponibili.',
      },
    ],
    ctaHeading: 'Scopri i Gioielli Botanici',
    ctaText: 'Vedi Catalogo',
  },

  de: {
    meta: {
      title: 'Botanischer Schmuck mit echten Blumen | Eternal Flowers',
      description:
        'Handgefertigter botanischer Schmuck mit echten Blumen, in Harz konserviert. Einzigartige Stücke handgefertigt in Braga, Portugal von Marina. Ohrringe, Halsketten und Anhänger mit natürlichen Blumen.',
      ogTitle: 'Botanischer Schmuck mit echten Blumen | Eternal Flowers',
      ogDescription:
        'Handgefertigter botanischer Schmuck mit echten Blumen, in Harz konserviert. Einzigartige Stücke handgefertigt in Braga, Portugal von Marina.',
    },
    h1: 'Botanischer Schmuck mit echten Blumen',
    intro:
      'Bei Eternal Flowers beginnt jedes Schmuckstück mit einer echten Blume. Wir bewahren die natürliche Schönheit der Blumen in Harz, um einzigartige Stücke zu schaffen, handgefertigt in Braga, Portugal. Ohrringe, Halsketten, Armbänder und Anhänger, die echte Blumen in zeitlose Erinnerungen verwandeln.',
    sections: [
      {
        heading: 'Was Ist Botanischer Schmuck?',
        body: [
          'Botanischer Schmuck sind handgefertigte Kreationen, die natürliche Elemente — echte Blumen, Blätter und Blütenblätter — in tragbare Schmuckstücke verwandeln. Anders als herkömmlicher Schmuck trägt jedes botanische Stück die Geschichte einer echten Blume in sich, konserviert um zu halten.',
          'Bei Eternal Flowers verwenden wir ausschließlich natürliche Blumen. Die Blütenblätter, Formen und Farben jeder Blume werden durch einen handwerklichen Prozess der Konservierung in Harz bewahrt, der die Blume schützt ohne ihre Authentizität zu verlieren.',
        ],
      },
      {
        heading: 'Echte Blumen in Harz Konserviert',
        body: [
          'Ja, die Blumen sind echt. Wir verwenden keine künstlichen Blumen oder Imitationen. Jedes Stück beginnt mit einer echten Blume — Orchideen, Rosen und anderen Sorten — sorgfältig ausgewählt und in Harz konserviert.',
          'Das klare Harz umschließt jede Blume und erhält ihre Form, Textur und Farbe. Dieser Prozess ermöglicht es, die natürliche Schönheit der Blume über die Zeit zu genießen und etwas Vergängliches in dauerhaften Schmuck zu verwandeln.',
        ],
      },
      {
        heading: 'Handgefertigt von Marina in Braga',
        body: [
          'Jedes Stück wird von Marina im Atelier von Eternal Flowers in Braga, Portugal, handgefertigt. Es gibt keine Massenproduktion. Marina wählt persönlich jede Blume aus und widmet sich jedem Detail mit der Sorgfalt, die den Wert langsamer, bewusster Arbeit kennt.',
          'Diese handwerkliche Sorgfalt bedeutet, dass jedes botanische Schmuckstück individuelle Aufmerksamkeit erhält, von der Wahl der Blume bis zur endgültigen Harzveredelung.',
        ],
      },
      {
        heading: 'Jede Blume Macht das Stück Anders',
        body: [
          'Durch die Verwendung natürlicher Blumen hat jedes Stück seine eigenen Merkmale — die Position der Blütenblätter, die Farbnuancen, die Form der Blume. Diese natürliche Variation ist Teil dessen, was jede Schöpfung besonders macht.',
          'Wenn Sie sich für ein botanisches Schmuckstück von Eternal Flowers entscheiden, nehmen Sie eine Blume mit nach Hause, die existierte, sorgfältig ausgewählt und in etwas verwandelt wurde, das Sie für immer bewahren können.',
        ],
      },
      {
        heading: 'Arten von Schmuckstücken',
        body: [
          'Wir arbeiten mit verschiedenen Arten von botanischem Schmuck, damit Sie das perfekte Stück finden: Ohrringe, Halsketten, Armbänder und Anhänger mit konservierten natürlichen Blumen. Jede Art bietet eine andere Möglichkeit, die Schönheit der Blumen zu tragen und zu zeigen.',
          'Wir laden Sie ein, den Katalog zu erkunden, um die verfügbaren Stücke zu entdecken und das passende für sich zu finden.',
        ],
      },
      {
        heading: 'Personalisierung',
        body: [
          'Jedes Stück kann für Sie personalisiert werden. Eternal Flowers schätzt den direkten Kontakt mit jedem Kunden, und die Personalisierung ist Teil der Erfahrung. Wenn Sie eine Lieblingsblume oder eine Idee im Kopf haben, kann Marina ein speziell für Sie entworfenes Stück anfertigen.',
          'Nehmen Sie Kontakt auf, damit wir über Ihr ideales botanisches Schmuckstück sprechen können.',
        ],
      },
    ],
    faq: [
      {
        q: 'Sind die Blumen wirklich echt?',
        a: 'Ja, aller botanischer Schmuck von Eternal Flowers wird mit echten Blumen hergestellt. Wir verwenden keine künstlichen Blumen. Jedes Stück beginnt mit einer echten Blume, die in Harz konserviert wird.',
      },
      {
        q: 'Wie werden die Blumen in die Stücke eingearbeitet?',
        a: 'Die Blumen werden sorgfältig ausgewählt und durch einen handwerklichen Harzprozess konserviert. Das Harz umschließt die Blume und erhält ihre natürliche Form und Farbe.',
      },
      {
        q: 'Wer stellt die Stücke her?',
        a: 'Alle Stücke werden von Marina im Atelier in Braga, Portugal, handgefertigt.',
      },
      {
        q: 'Wo wird der Schmuck hergestellt?',
        a: 'Alle Stücke werden in Braga, Portugal, im Atelier von Eternal Flowers handgefertigt.',
      },
      {
        q: 'Kann ich ein Stück personalisieren?',
        a: 'Ja. Eternal Flowers schätzt den direkten Kontakt mit jedem Kunden. Kontaktieren Sie uns und erzählen Sie uns, was Sie im Sinn haben.',
      },
      {
        q: 'Welche Arten von botanischem Schmuck bieten Sie an?',
        a: 'Wir fertigen Ohrringe, Halsketten, Armbänder, Anhänger und Sets mit konservierten natürlichen Blumen. Durchsuchen Sie den Katalog, um aktuelle Stücke zu sehen.',
      },
      {
        q: 'Wie kann ich die verfügbaren Stücke sehen?',
        a: 'Erkunden Sie unseren Online-Katalog, um den aktuell verfügbaren botanischen Schmuck zu entdecken.',
      },
    ],
    ctaHeading: 'Botanischen Schmuck Entdecken',
    ctaText: 'Katalog Ansehen',
  },
}

export const orchidContent: Record<string, LandingContent> = {
  pt: {
    meta: {
      title: 'Joias com Orquídeas Naturais | Eternal Flowers',
      description:
        'Joias com orquídeas naturais verdadeiras, preservadas em resina. Peças únicas feitas à mão em Braga pela Marina. Brincos, colares e pingentes com orquídeas reais.',
      ogTitle: 'Joias com Orquídeas Naturais | Eternal Flowers',
      ogDescription:
        'Joias com orquídeas naturais verdadeiras, preservadas em resina. Peças únicas feitas à mão em Braga pela Marina.',
    },
    h1: 'Joias com Orquídeas Naturais',
    intro:
      'Na Eternal Flowers, as orquídeas são uma das flores mais especiais que usamos nas nossas joias botânicas. Verdadeiras, não artificiais. Cada pétala, cada forma, cada tom é preservado em resina para criar peças únicas, feitas à mão pela Marina, em Braga. Brincos, colares e pingentes que guardam a beleza das orquídeas para sempre.',
    sections: [
      {
        heading: 'Orquídeas Verdadeiras Transformadas em Joias Botânicas',
        body: [
          'As orquídeas que usamos na Eternal Flowers são flores verdadeiras. Não são artificiais nem imitações. Cada peça começa com uma orquídea real, que é transformada numa joia botânica através de um processo artesanal de preservação em resina.',
          'A estrutura única das orquídeas — as pétalas, o labelo, as cores — torna-as especialmente bonitas quando preservadas em resina. Cada variedade traz a sua própria personalidade à peça.',
        ],
      },
      {
        heading: 'Preservar a Forma e a Beleza da Flor',
        body: [
          'Quando uma orquídea é incorporada numa joia, a sua forma natural é mantida. A resina envolve a flor, protegendo-a e permitindo que a sua beleza seja apreciada ao longo do tempo.',
          'É um processo que exige cuidado e paciência: cada flor é delicadamente posicionada para que a sua estrutura e cor fiquem visíveis na peça final.',
        ],
      },
      {
        heading: 'Da Flor à Peça Artesanal',
        body: [
          'A Marina trabalha cada orquídea à mão, escolhendo a flor certa para cada peça. O trabalho artesanal significa que não há duas iguais — cada orquídea tem a sua forma, e cada peça é feita individualmente.',
          'Este processo manual é o que distingue as joias botânicas da Eternal Flowers: não há produção industrial, apenas o cuidado de quem faz cada peça com atenção.',
        ],
      },
      {
        heading: 'Criadas pela Marina em Braga',
        body: [
          'Todas as peças são criadas pela Marina no atelier da Eternal Flowers em Braga, Portugal. É aqui que as orquídeas são selecionadas, preparadas e transformadas em joias, num trabalho que combina sensibilidade artística e rigor artesanal.',
          'O atelier em Braga é o coração da Eternal Flowers — o lugar onde as flores encontram a resina e se tornam memórias.',
        ],
      },
      {
        heading: 'Descobrir as Peças',
        body: [
          'Convidamo-lo a explorar o catálogo para descobrir as peças disponíveis com orquídeas naturais. Brincos, colares, pulseiras e pingentes — cada um feito à mão com orquídeas reais preservadas em resina.',
          'Visite também a nossa página sobre joias botânicas para saber mais sobre o nosso trabalho com flores naturais.',
        ],
      },
    ],
    faq: [
      {
        q: 'São orquídeas verdadeiras?',
        a: 'Sim, as orquídeas usadas nas joias Eternal Flowers são verdadeiras e naturais. Não utilizamos flores artificiais.',
      },
      {
        q: 'As flores são artificiais?',
        a: 'Não. Todas as flores, incluindo as orquídeas, são naturais e verdadeiras. São preservadas em resina para manter a sua forma e cor.',
      },
      {
        q: 'É possível personalizar uma peça com orquídeas?',
        a: 'Sim. A Eternal Flowers valoriza o contacto direto com cada cliente. Fale connosco para conversarmos sobre a sua ideia.',
      },
      {
        q: 'Todas as peças com orquídeas são iguais?',
        a: 'Não. Como usamos orquídeas naturais, cada peça tem as suas próprias características — a posição das pétalas, os tons de cor, a forma da flor. Cada criação é feita à mão, individualmente.',
      },
    ],
    ctaHeading: 'Descobrir as Joias com Orquídeas',
    ctaText: 'Ver Catálogo',
  },

  en: {
    meta: {
      title: 'Natural Orchid Jewellery | Eternal Flowers',
      description:
        'Jewellery made with real natural orchids, preserved in resin. Unique pieces handcrafted in Braga, Portugal by Marina. Earrings, necklaces and pendants with real orchids.',
      ogTitle: 'Natural Orchid Jewellery | Eternal Flowers',
      ogDescription:
        'Jewellery made with real natural orchids, preserved in resin. Unique pieces handcrafted in Braga, Portugal by Marina.',
    },
    h1: 'Natural Orchid Jewellery',
    intro:
      'At Eternal Flowers, orchids are among the most special flowers we use in our botanical jewellery. Real, not artificial. Every petal, every shape, every tone is preserved in resin to create unique pieces, handmade by Marina in Braga. Earrings, necklaces and pendants that hold the beauty of orchids forever.',
    sections: [
      {
        heading: 'Real Orchids Transformed into Botanical Jewellery',
        body: [
          'The orchids we use at Eternal Flowers are real flowers. They are not artificial or imitations. Each piece begins with a real orchid, transformed into botanical jewellery through a handcrafted resin preservation process.',
          'The unique structure of orchids — the petals, the lip, the colours — makes them especially beautiful when preserved in resin. Each variety brings its own personality to the piece.',
        ],
      },
      {
        heading: 'Preserving the Form and Beauty of the Flower',
        body: [
          'When an orchid is incorporated into a piece of jewellery, its natural form is maintained. The resin encases the flower, protecting it and allowing its beauty to be enjoyed over time.',
          'It is a process that requires care and patience: each flower is delicately positioned so that its structure and colour are visible in the final piece.',
        ],
      },
      {
        heading: 'From Flower to Handcrafted Piece',
        body: [
          'Marina works each orchid by hand, choosing the right flower for each piece. The handcrafted approach means no two are alike — each orchid has its own form, and each piece is made individually.',
          'This handmade process is what sets Eternal Flowers botanical jewellery apart: there is no industrial production, only the care of someone who makes each piece with attention.',
        ],
      },
      {
        heading: 'Created by Marina in Braga',
        body: [
          'All pieces are created by Marina at the Eternal Flowers atelier in Braga, Portugal. This is where the orchids are selected, prepared and transformed into jewellery, in work that combines artistic sensitivity and handcrafted precision.',
          'The atelier in Braga is the heart of Eternal Flowers — the place where flowers meet resin and become keepsakes.',
        ],
      },
      {
        heading: 'Discover the Pieces',
        body: [
          'We invite you to explore the catalogue to discover available pieces made with natural orchids. Earrings, necklaces, bracelets and pendants — each handmade with real orchids preserved in resin.',
          'Also visit our botanical jewellery page to learn more about our work with natural flowers.',
        ],
      },
    ],
    faq: [
      {
        q: 'Are the orchids real?',
        a: 'Yes, the orchids used in Eternal Flowers jewellery are real and natural. We do not use artificial flowers.',
      },
      {
        q: 'Are the flowers artificial?',
        a: 'No. All flowers, including the orchids, are natural and real. They are preserved in resin to maintain their shape and colour.',
      },
      {
        q: 'Can I personalise an orchid piece?',
        a: 'Yes. Eternal Flowers values direct contact with each customer. Get in touch to tell us about your idea.',
      },
      {
        q: 'Are all orchid pieces the same?',
        a: 'No. Because we use natural orchids, each piece has its own characteristics — the position of the petals, the colour tones, the shape of the flower. Each creation is made by hand, individually.',
      },
    ],
    ctaHeading: 'Discover Orchid Jewellery',
    ctaText: 'View Catalogue',
  },

  es: {
    meta: {
      title: 'Joyas con Orquídeas Naturales | Eternal Flowers',
      description:
        'Joyas con orquídeas naturales verdaderas, preservadas en resina. Piezas únicas hechas a mano en Braga, Portugal por Marina. Pendientes, collares y colgantes con orquídeas reales.',
      ogTitle: 'Joyas con Orquídeas Naturales | Eternal Flowers',
      ogDescription:
        'Joyas con orquídeas naturales verdaderas, preservadas en resina. Piezas únicas hechas a mano en Braga, Portugal por Marina.',
    },
    h1: 'Joyas con Orquídeas Naturales',
    intro:
      'En Eternal Flowers, las orquídeas son una de las flores más especiales que usamos en nuestras joyas botánicas. Verdaderas, no artificiales. Cada pétalo, cada forma, cada tono es preservado en resina para crear piezas únicas, hechas a mano por Marina en Braga. Pendientes, collares y colgantes que guardan la belleza de las orquídeas para siempre.',
    sections: [
      {
        heading: 'Orquídeas Verdaderas Transformadas en Joyas Botánicas',
        body: [
          'Las orquídeas que usamos en Eternal Flowers son flores verdaderas. No son artificiales ni imitaciones. Cada pieza comienza con una orquídea real, transformada en una joya botánica mediante un proceso artesanal de preservación en resina.',
          'La estructura única de las orquídeas — los pétalos, el labelo, los colores — las hace especialmente bellas al preservarlas en resina. Cada variedad aporta su propia personalidad a la pieza.',
        ],
      },
      {
        heading: 'Preservar la Forma y la Belleza de la Flor',
        body: [
          'Cuando una orquídea se incorpora a una joya, su forma natural se mantiene. La resina envuelve la flor, protegiéndola y permitiendo que su belleza sea apreciada con el tiempo.',
          'Es un proceso que requiere cuidado y paciencia: cada flor se coloca delicadamente para que su estructura y color sean visibles en la pieza final.',
        ],
      },
      {
        heading: 'De la Flor a la Pieza Artesanal',
        body: [
          'Marina trabaja cada orquídea a mano, eligiendo la flor adecuada para cada pieza. El trabajo artesanal significa que no hay dos iguales — cada orquídea tiene su forma, y cada pieza se hace individualmente.',
          'Este proceso manual es lo que distingue a las joyas botánicas de Eternal Flowers: no hay producción industrial, solo el cuidado de quien hace cada pieza con atención.',
        ],
      },
      {
        heading: 'Creadas por Marina en Braga',
        body: [
          'Todas las piezas son creadas por Marina en el taller de Eternal Flowers en Braga, Portugal. Aquí es donde las orquídeas se seleccionan, preparan y transforman en joyas, en un trabajo que combina sensibilidad artística y precisión artesanal.',
          'El taller en Braga es el corazón de Eternal Flowers — el lugar donde las flores encuentran la resina y se convierten en recuerdos.',
        ],
      },
      {
        heading: 'Descubrir las Piezas',
        body: [
          'Le invitamos a explorar el catálogo para descubrir las piezas disponibles con orquídeas naturales. Pendientes, collares, pulseras y colgantes — cada uno hecho a mano con orquídeas reales preservadas en resina.',
          'Visite también nuestra página sobre joyería botánica para saber más sobre nuestro trabajo con flores naturales.',
        ],
      },
    ],
    faq: [
      {
        q: '¿Son orquídeas verdaderas?',
        a: 'Sí, las orquídeas utilizadas en las joyas de Eternal Flowers son verdaderas y naturales. No usamos flores artificiales.',
      },
      {
        q: '¿Las flores son artificiales?',
        a: 'No. Todas las flores, incluidas las orquídeas, son naturales y verdaderas. Se preservan en resina para mantener su forma y color.',
      },
      {
        q: '¿Se puede personalizar una pieza con orquídeas?',
        a: 'Sí. Eternal Flowers valora el contacto directo con cada cliente. Contáctenos para contarnos su idea.',
      },
      {
        q: '¿Todas las piezas con orquídeas son iguales?',
        a: 'No. Al usar orquídeas naturales, cada pieza tiene sus propias características: la posición de los pétalos, los tonos de color, la forma de la flor. Cada creación se hace a mano, individualmente.',
      },
    ],
    ctaHeading: 'Descubrir las Joyas con Orquídeas',
    ctaText: 'Ver Catálogo',
  },

  it: {
    meta: {
      title: 'Gioielli con Orchidee Naturali | Eternal Flowers',
      description:
        'Gioielli con orchidee naturali vere, preservati nella resina. Pezzi unici fatti a mano a Braga, Portogallo da Marina. Orecchini, collane e pendenti con orchidee vere.',
      ogTitle: 'Gioielli con Orchidee Naturali | Eternal Flowers',
      ogDescription:
        'Gioielli con orchidee naturali vere, preservati nella resina. Pezzi unici fatti a mano a Braga, Portogallo da Marina.',
    },
    h1: 'Gioielli con Orchidee Naturali',
    intro:
      'Da Eternal Flowers, le orchidee sono tra i fiori più speciali che usiamo nei nostri gioielli botanici. Vere, non artificiali. Ogni petalo, ogni forma, ogni tono è preservato nella resina per creare pezzi unici, fatti a mano da Marina a Braga. Orecchini, collane e pendenti che custodiscono la bellezza delle orchidee per sempre.',
    sections: [
      {
        heading: 'Orchidee Vere Trasformate in Gioielli Botanici',
        body: [
          'Le orchidee che usiamo da Eternal Flowers sono fiori veri. Non sono artificiali né imitazioni. Ogni pezzo inizia con unorchidea vera, trasformata in un gioiello botanico attraverso un processo artigianale di preservazione nella resina.',
          'La struttura unica delle orchidee — i petali, il labello, i colori — le rende particolarmente belle quando preservate nella resina. Ogni varietà porta la propria personalità al pezzo.',
        ],
      },
      {
        heading: 'Preservare la Forma e la Bellezza del Fiore',
        body: [
          'Quando unorchidea è incorporata in un gioiello, la sua forma naturale è mantenuta. La resina avvolge il fiore, proteggendolo e permettendo che la sua bellezza sia apprezzata nel tempo.',
          'È un processo che richiede cura e pazienza: ogni fiore è delicatamente posizionato affinché la sua struttura e il suo colore siano visibili nel pezzo finale.',
        ],
      },
      {
        heading: 'Dal Fiore al Pezzo Artigianale',
        body: [
          'Marina lavora ogni orchidea a mano, scegliendo il fiore giusto per ogni pezzo. Il lavoro artigianale significa che non ce ne sono due uguali — ogni orchidea ha la sua forma e ogni pezzo è realizzato individualmente.',
          'Questo processo manuale è ciò che distingue i gioielli botanici di Eternal Flowers: non cè produzione industriale, solo la cura di chi realizza ogni pezzo con attenzione.',
        ],
      },
      {
        heading: 'Creati da Marina a Braga',
        body: [
          'Tutti i pezzi sono creati da Marina nellatelier di Eternal Flowers a Braga, Portogallo. È qui che le orchidee vengono selezionate, preparate e trasformate in gioielli, in un lavoro che unisce sensibilità artistica e precisione artigianale.',
          'Latelier di Braga è il cuore di Eternal Flowers — il luogo dove i fiori incontrano la resina e diventano ricordi.',
        ],
      },
      {
        heading: 'Scopri i Pezzi',
        body: [
          'Vi invitiamo a esplorare il catalogo per scoprire i pezzi disponibili con orchidee naturali. Orecchini, collane, bracciali e pendenti — ognuno fatto a mano con orchidee vere preservate nella resina.',
          'Visitate anche la nostra pagina sui gioielli botanici per saperne di più sul nostro lavoro con i fiori naturali.',
        ],
      },
    ],
    faq: [
      {
        q: 'Le orchidee sono vere?',
        a: 'Sì, le orchidee utilizzate nei gioielli di Eternal Flowers sono vere e naturali. Non usiamo fiori artificiali.',
      },
      {
        q: 'I fiori sono artificiali?',
        a: 'No. Tutti i fiori, incluse le orchidee, sono naturali e veri. Sono preservati nella resina per mantenere la loro forma e colore.',
      },
      {
        q: 'È possibile personalizzare un pezzo con orchidee?',
        a: 'Sì. Eternal Flowers valorizza il contatto diretto con ogni cliente. Contattateci per raccontarci la vostra idea.',
      },
      {
        q: 'Tutti i pezzi con orchidee sono uguali?',
        a: 'No. Usando orchidee naturali, ogni pezzo ha le sue caratteristiche: la posizione dei petali, le sfumature di colore, la forma del fiore. Ogni creazione è fatta a mano, individualmente.',
      },
    ],
    ctaHeading: 'Scopri i Gioielli con Orchidee',
    ctaText: 'Vedi Catalogo',
  },

  de: {
    meta: {
      title: 'Orchideen-Schmuck mit echten Orchideen | Eternal Flowers',
      description:
        'Schmuck mit echten natürlichen Orchideen, in Harz konserviert. Einzigartige Stücke handgefertigt in Braga, Portugal von Marina. Ohrringe, Halsketten und Anhänger mit echten Orchideen.',
      ogTitle: 'Orchideen-Schmuck mit echten Orchideen | Eternal Flowers',
      ogDescription:
        'Schmuck mit echten natürlichen Orchideen, in Harz konserviert. Einzigartige Stücke handgefertigt in Braga, Portugal von Marina.',
    },
    h1: 'Orchideen-Schmuck mit echten Orchideen',
    intro:
      'Bei Eternal Flowers sind Orchideen eine der besonderen Blumen, die wir in unserem botanischen Schmuck verwenden. Echt, nicht künstlich. Jedes Blütenblatt, jede Form, jeder Farbton wird in Harz konserviert, um einzigartige Stücke zu schaffen, handgefertigt von Marina in Braga. Ohrringe, Halsketten und Anhänger, die die Schönheit der Orchideen für immer bewahren.',
    sections: [
      {
        heading: 'Echte Orchideen Verwandelt in Botanischen Schmuck',
        body: [
          'Die Orchideen, die wir bei Eternal Flowers verwenden, sind echte Blumen. Sie sind weder künstlich noch Nachahmungen. Jedes Stück beginnt mit einer echten Orchidee, die durch einen handwerklichen Harzkonservierungsprozess in botanischen Schmuck verwandelt wird.',
          'Die einzigartige Struktur der Orchideen — die Blütenblätter, die Lippe, die Farben — macht sie besonders schön, wenn sie in Harz konserviert werden. Jede Sorte bringt ihre eigene Persönlichkeit in das Stück ein.',
        ],
      },
      {
        heading: 'Die Form und Schönheit der Blume Bewahren',
        body: [
          'Wenn eine Orchidee in ein Schmuckstück eingearbeitet wird, bleibt ihre natürliche Form erhalten. Das Harz umschließt die Blume, schützt sie und ermöglicht es, ihre Schönheit über die Zeit zu genießen.',
          'Es ist ein Prozess, der Sorgfalt und Geduld erfordert: jede Blume wird behutsam positioniert, damit ihre Struktur und Farbe im endgültigen Stück sichtbar sind.',
        ],
      },
      {
        heading: 'Von der Blume zum Handgefertigten Stück',
        body: [
          'Marina bearbeitet jede Orchidee von Hand und wählt die richtige Blume für jedes Stück. Die handwerkliche Herstellung bedeutet, dass keine zwei gleich sind — jede Orchidee hat ihre eigene Form, und jedes Stück wird einzeln angefertigt.',
          'Dieser handgefertigte Prozess zeichnet den botanischen Schmuck von Eternal Flowers aus: es gibt keine industrielle Produktion, nur die Sorgfalt einer Person, die jedes Stück mit Aufmerksamkeit anfertigt.',
        ],
      },
      {
        heading: 'Hergestellt von Marina in Braga',
        body: [
          'Alle Stücke werden von Marina im Atelier von Eternal Flowers in Braga, Portugal, hergestellt. Hier werden die Orchideen ausgewählt, vorbereitet und in Schmuck verwandelt, in einer Arbeit, die künstlerische Sensibilität und handwerkliche Präzision vereint.',
          'Das Atelier in Braga ist das Herz von Eternal Flowers — der Ort, an dem Blumen auf Harz treffen und zu Erinnerungen werden.',
        ],
      },
      {
        heading: 'Die Stücke Entdecken',
        body: [
          'Wir laden Sie ein, den Katalog zu erkunden, um die verfügbaren Stücke mit natürlichen Orchideen zu entdecken. Ohrringe, Halsketten, Armbänder und Anhänger — jedes handgefertigt mit echten Orchideen, konserviert in Harz.',
          'Besuchen Sie auch unsere Seite über botanischen Schmuck, um mehr über unsere Arbeit mit natürlichen Blumen zu erfahren.',
        ],
      },
    ],
    faq: [
      {
        q: 'Sind die Orchideen echt?',
        a: 'Ja, die in Eternal Flowers Schmuck verwendeten Orchideen sind echt und natürlich. Wir verwenden keine künstlichen Blumen.',
      },
      {
        q: 'Sind die Blumen künstlich?',
        a: 'Nein. Alle Blumen, einschließlich der Orchideen, sind natürlich und echt. Sie werden in Harz konserviert, um ihre Form und Farbe zu erhalten.',
      },
      {
        q: 'Kann ich ein Stück mit Orchideen personalisieren?',
        a: 'Ja. Eternal Flowers schätzt den direkten Kontakt mit jedem Kunden. Kontaktieren Sie uns und erzählen Sie uns von Ihrer Idee.',
      },
      {
        q: 'Sind alle Orchideenstücke gleich?',
        a: 'Nein. Da wir natürliche Orchideen verwenden, hat jedes Stück seine eigenen Merkmale: die Position der Blütenblätter, die Farbnuancen, die Form der Blume. Jede Kreation wird von Hand und individuell gefertigt.',
      },
    ],
    ctaHeading: 'Orchideen-Schmuck Entdecken',
    ctaText: 'Katalog Ansehen',
  },
}