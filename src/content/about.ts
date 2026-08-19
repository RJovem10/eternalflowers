// Conteúdo editorial da página "Conhecer a Marina"
// Texto base aprovado — traduções verificadas (Julho 2026)

export type AboutContent = {
  hero: { label: string; title: string; subtitle: string }
  section2: { label: string; title: string; paragraphs: string[] }
  section3: { label: string; title: string; paragraphs: string[] }
  section4: { label: string; title: string; paragraphs: string[] }
  section5: { label: string; title: string; paragraphs: string[] }
  section6: { label: string; title: string; paragraphs: string[] }
  section7: { label: string; title: string; paragraphs: string[] }
  section8: { label: string; title: string; paragraphs: string[] }
  quote: { text: string; author: string }
  cta: { heading: string; text: string; link: string }
  meta: { title: string; description: string }
}

export const aboutContent: Record<string, AboutContent> = {
  pt: {
    hero: {
      label: 'A Artesã',
      title: 'Conhecer a Marina',
      subtitle: 'A mão e o coração por detrás de cada peça Eternal Flowers.',
    },
    section2: {
      label: 'Raízes',
      title: 'Entre a terra, a ciência e o cuidado com a vida',
      paragraphs: [
        'Marina nasceu em São Paulo, Brasil, filha de pais portugueses. Veio viver para Portugal aos quatro anos.',
        'Quando tinha cerca de quatro anos e ainda vivia em São Paulo, Marina tinha uma romãzeira como melhor amiga. Esta memória de infância revela uma ligação à natureza que a acompanharia ao longo da vida.',
        'Mais tarde, formou-se em Engenharia Agronómica e exerceu como engenheira. A formação científica aprofundou a sua compreensão da natureza e dos seres vivos.',
        'Mas o percurso profissional tomou um novo rumo — o do cuidado com as pessoas.',
      ],
    },
    section3: {
      label: 'Cuidado',
      title: 'O caminho para a medicina natural',
      paragraphs: [
        'Marina descobriu a naturopatia e a Quiropraxia Oriental, ligada à Medicina Chinesa. Neste percurso, a natureza tem um papel importante: são valorizadas abordagens e métodos não invasivos, que promovem o equilíbrio e o bem-estar do organismo.',
        'Aprendeu a olhar para a pessoa como um todo e a integrar princípios naturais no cuidado.',
        'Este olhar atento, esta paciência para ouvir e observar — são as mesmas qualidades que hoje aplica na criação de cada joia botânica.',
      ],
    },
    section4: {
      label: 'Mar&Natur',
      title: 'Onde o cuidado encontra a natureza',
      paragraphs: [
        'Marina criou a Mar&Natur em Vila de Prado, Braga. Trabalha nesta área há cerca de 16 anos, tendo feito formações em Portugal e no estrangeiro. Tornou-se uma terapeuta conhecida na região de Braga.',
        'Na Mar&Natur, Marina aplica a mesma dedicação, proximidade e atenção que marcam a sua forma de estar com as pessoas. A natureza, os métodos não invasivos e o equilíbrio do organismo têm um papel importante no seu percurso profissional.',
        'Marina divide a vida entre Braga e Lisboa.',
      ],
    },
    section5: {
      label: 'A Descoberta',
      title: 'De uma viagem à Tailândia nasceu a Eternal Flowers',
      paragraphs: [
        'A paixão pelas orquídeas nasceu durante uma viagem à Tailândia, quando visitou um orquidário. Foi nesse contacto com a diversidade e a beleza destas flores que começou uma ligação que viria a marcar o seu percurso artesanal.',
        'Mais tarde, começou a experimentar a desidratação de flores e a sua preservação em resina epóxi. Frequentou cursos e aperfeiçoou a técnica.',
        'A Eternal Flowers nasceu e continua a crescer.',
      ],
    },
    section6: {
      label: 'Processo',
      title: 'Aprendizagem e aperfeiçoamento artesanal',
      paragraphs: [
        'Foi convidada para expor devido à qualidade das peças e ao trabalho artesanal. Cada peça que cria é o resultado de estudo, prática e aperfeiçoamento constante.',
        'Através de cursos, estudo e prática, Marina foi aperfeiçoando o processo de desidratação das flores e de preservação em resina epóxi.',
        'Cada peça reflete esse percurso de aprendizagem, experimentação e aperfeiçoamento.',
      ],
    },
    section7: {
      label: 'Exposições',
      title: 'Exposições em Portugal e Espanha',
      paragraphs: [
        'A Eternal Flowers tem marcado presença em exposições em Portugal e Espanha.',
        'Em Espanha, participou em exposições em Estepona e Córdoba. Em Portugal, esteve presente em Lisboa, incluindo o Jardim Zoológico, em Coimbra e noutros locais.',
        'Cada participação representa uma nova etapa no crescimento da marca e uma oportunidade de apresentar o seu trabalho a pessoas interessadas na natureza, no artesanato e em peças com significado.',
      ],
    },
    section8: {
      label: 'Essência',
      title: 'A pessoa por detrás de cada peça',
      paragraphs: [
        'Na Eternal Flowers, cada peça nasce para imortalizar a beleza de uma flor.',
        'Não vende simplesmente joias. Ajuda pessoas a guardar memórias que podem usar ao peito, nos dedos, nas orelhas — todos os dias.',
        'Uma flor é efémera. Uma peça Eternal Flowers procura preservar a sua beleza e a memória que lhe está associada.',
        'Marina é amiga, divertida, prestável e dedicada. É exigente com a qualidade e não gosta de deixar clientes ou pacientes insatisfeitos.',
        'Cada peça que cria é um pedaço de si que fica com quem a escolhe.',
      ],
    },
    quote: {
      text: 'Não vendo simplesmente joias. Ajudo pessoas a guardar memórias que podem usar ao peito todos os dias.',
      author: 'Marina',
    },
    cta: {
      heading: 'Queres criar uma peça tua?',
      text: 'Descobrir as peças',
      link: '/catalog',
    },
    meta: {
      title: 'Conhecer a Marina',
      description:
        'Conhece a Marina, engenheira agronómica, naturopata e artesã por detrás da Eternal Flowers. A história de como uma viagem à Tailândia e uma paixão por orquídeas deram origem a joias botânicas que imortalizam a beleza das flores.',
    },
  },

  en: {
    hero: {
      label: 'The Artisan',
      title: 'Meet Marina',
      subtitle: 'The hand and heart behind every Eternal Flowers piece.',
    },
    section2: {
      label: 'Roots',
      title: 'Between the land, science and caring for life',
      paragraphs: [
        'Marina was born in São Paulo, Brazil, to Portuguese parents. She moved to Portugal at the age of four.',
        'When she was about four years old and still living in São Paulo, Marina had a pomegranate tree as her best friend. This childhood memory reveals a connection to nature that would stay with her throughout her life.',
        'Later, she graduated in Agricultural Engineering and worked as an engineer. Her scientific training deepened her understanding of nature and living beings.',
        'But her professional path took a new direction — one of caring for people.',
      ],
    },
    section3: {
      label: 'Care',
      title: 'The path to natural medicine',
      paragraphs: [
        'Marina discovered naturopathy and Oriental Chiropractic, linked to Chinese Medicine. In this journey, nature plays an important role: non-invasive approaches and methods are valued, promoting balance and well-being.',
        'She learned to see the person as a whole and to integrate natural principles into her care.',
        'This attentive gaze, this patience to listen and observe — these are the same qualities she now applies to creating each botanical jewel.',
      ],
    },
    section4: {
      label: 'Mar&Natur',
      title: 'Where care meets nature',
      paragraphs: [
        'Marina founded Mar&Natur in Vila de Prado, Braga. She has been working in this field for about 16 years, having trained in Portugal and abroad. She became a well-known therapist in the Braga region.',
        'At Mar&Natur, Marina brings the same dedication, closeness and attention that define her way of being with people. Nature, non-invasive methods and the balance of the organism play an important role in her professional journey.',
        'Marina divides her life between Braga and Lisbon.',
      ],
    },
    section5: {
      label: 'The Discovery',
      title: 'From a trip to Thailand, Eternal Flowers was born',
      paragraphs: [
        'Her passion for orchids was born during a trip to Thailand, when she visited an orchid nursery. It was in this contact with the diversity and beauty of these flowers that a connection began — one that would come to mark her artisanal path.',
        'Later, she began experimenting with flower drying and preservation in epoxy resin. She took courses and refined the technique.',
        'Eternal Flowers was born and continues to grow.',
      ],
    },
    section6: {
      label: 'Process',
      title: 'Learning and perfecting the craft',
      paragraphs: [
        'She was invited to exhibit due to the quality of her pieces and her artisan work. Each piece she creates is the result of study, practice and constant refinement.',
        'Through courses, study and practice, Marina has been perfecting the process of drying flowers and preserving them in epoxy resin.',
        'Each piece reflects this journey of learning, experimentation and refinement.',
      ],
    },
    section7: {
      label: 'Exhibitions',
      title: 'Exhibitions in Portugal and Spain',
      paragraphs: [
        'Eternal Flowers has been present at exhibitions in Portugal and Spain.',
        'In Spain, she participated in exhibitions in Estepona and Córdoba. In Portugal, she has been present in Lisbon, including the Lisbon Zoo, in Coimbra and in other locations.',
        'Each participation represents a new chapter in the growth of the brand and an opportunity to present her work to people interested in nature, craftsmanship and meaningful pieces.',
      ],
    },
    section8: {
      label: 'Essence',
      title: 'The person behind every piece',
      paragraphs: [
        'At Eternal Flowers, each piece is born to immortalise the beauty of a flower.',
        'She does not simply sell jewellery. She helps people keep memories they can wear at their chest, on their fingers, on their ears — every day.',
        'A flower is ephemeral. An Eternal Flowers piece seeks to preserve its beauty and the memory associated with it.',
        'Marina is a friend, fun, helpful and dedicated. She is demanding about quality and does not like to leave clients or patients unsatisfied.',
        'Each piece she creates is a part of herself that stays with whoever chooses it.',
      ],
    },
    quote: {
      text: 'I do not simply sell jewellery. I help people keep memories they can wear at their chest every day.',
      author: 'Marina',
    },
    cta: {
      heading: 'Would you like to create your own piece?',
      text: 'Discover the pieces',
      link: '/catalog',
    },
    meta: {
      title: 'Meet Marina',
      description:
        'Meet Marina, agricultural engineer, naturopath and artisan behind Eternal Flowers. The story of how a trip to Thailand and a passion for orchids gave rise to unique botanical jewellery that immortalises the beauty of flowers.',
    },
  },

  es: {
    hero: {
      label: 'La Artesana',
      title: 'Conocer a Marina',
      subtitle: 'La mano y el corazón detrás de cada pieza Eternal Flowers.',
    },
    section2: {
      label: 'Raíces',
      title: 'Entre la tierra, la ciencia y el cuidado de la vida',
      paragraphs: [
        'Marina nació en São Paulo, Brasil, hija de padres portugueses. Se mudó a Portugal a los cuatro años.',
        'Cuando tenía unos cuatro años y aún vivía en São Paulo, Marina tenía un granado como su mejor amiga. Este recuerdo de infancia revela una conexión con la naturaleza que la acompañaría a lo largo de su vida.',
        'Más tarde, se graduó en Ingeniería Agronómica y ejerció como ingeniera. Su formación científica profundizó su comprensión de la naturaleza y los seres vivos.',
        'Pero su trayectoria profesional tomó un nuevo rumbo — el del cuidado de las personas.',
      ],
    },
    section3: {
      label: 'Cuidado',
      title: 'El camino hacia la medicina natural',
      paragraphs: [
        'Marina descubrió la naturopatía y la Quiropraxia Oriental, vinculada a la Medicina China. En este camino, la naturaleza juega un papel importante: se valoran los enfoques y métodos no invasivos, que promueven el equilibrio y el bienestar del organismo.',
        'Aprendió a ver a la persona como un todo y a integrar principios naturales en el cuidado.',
        'Esta mirada atenta, esta paciencia para escuchar y observar — son las mismas cualidades que hoy aplica en la creación de cada joya botánica.',
      ],
    },
    section4: {
      label: 'Mar&Natur',
      title: 'Donde el cuidado encuentra la naturaleza',
      paragraphs: [
        'Marina fundó Mar&Natur en Vila de Prado, Braga. Trabaja en este campo desde hace unos 16 años, habiéndose formado en Portugal y en el extranjero. Se convirtió en una terapeuta reconocida en la región de Braga.',
        'En Mar&Natur, Marina aplica la misma dedicación, cercanía y atención que definen su forma de estar con las personas. La naturaleza, los métodos no invasivos y el equilibrio del organismo tienen un papel importante en su trayectoria profesional.',
        'Marina divide su vida entre Braga y Lisboa.',
      ],
    },
    section5: {
      label: 'El Descubrimiento',
      title: 'De un viaje a Tailandia nació Eternal Flowers',
      paragraphs: [
        'Su pasión por las orquídeas nació durante un viaje a Tailandia, cuando visitó un orquidario. Fue en ese contacto con la diversidad y la belleza de estas flores donde comenzó una conexión que marcaría su camino artesanal.',
        'Más tarde, comenzó a experimentar con la deshidratación de flores y su preservación en resina epoxi. Tomó cursos y perfeccionó la técnica.',
        'Eternal Flowers nació y sigue creciendo.',
      ],
    },
    section6: {
      label: 'Proceso',
      title: 'Aprendizaje y perfeccionamiento artesanal',
      paragraphs: [
        'Fue invitada a exponer debido a la calidad de sus piezas y su trabajo artesanal. Cada pieza que crea es el resultado de estudio, práctica y perfeccionamiento constante.',
        'A través de cursos, estudio y práctica, Marina ha ido perfeccionando el proceso de deshidratación de flores y su preservación en resina epoxi.',
        'Cada pieza refleja este recorrido de aprendizaje, experimentación y perfeccionamiento.',
      ],
    },
    section7: {
      label: 'Exposiciones',
      title: 'Exposiciones en Portugal y España',
      paragraphs: [
        'Eternal Flowers ha estado presente en exposiciones en Portugal y España.',
        'En España, participó en exposiciones en Estepona y Córdoba. En Portugal, ha estado presente en Lisboa, incluido el Jardín Zoológico, en Coímbra y en otros lugares.',
        'Cada participación representa una nueva etapa en el crecimiento de la marca y una oportunidad de presentar su trabajo a personas interesadas en la naturaleza, la artesanía y las piezas con significado.',
      ],
    },
    section8: {
      label: 'Esencia',
      title: 'La persona detrás de cada pieza',
      paragraphs: [
        'En Eternal Flowers, cada pieza nace para inmortalizar la belleza de una flor.',
        'No vende simplemente joyas. Ayuda a personas a guardar recuerdos que pueden llevar al pecho, en los dedos, en las orejas — todos los días.',
        'Una flor es efímera. Una pieza Eternal Flowers busca preservar su belleza y el recuerdo que lleva asociado.',
        'Marina es amiga, divertida, servicial y dedicada. Es exigente con la calidad y no le gusta dejar clientes o pacientes insatisfechos.',
        'Cada pieza que crea es un pedazo de sí misma que se queda con quien la elige.',
      ],
    },
    quote: {
      text: 'No vendo simplemente joyas. Ayudo a personas a guardar recuerdos que pueden llevar al pecho todos los días.',
      author: 'Marina',
    },
    cta: {
      heading: '¿Quieres crear una pieza tuya?',
      text: 'Descubrir las piezas',
      link: '/catalogo',
    },
    meta: {
      title: 'Conocer a Marina',
      description:
        'Conoce a Marina, ingeniera agronómica, naturópata y artesana detrás de Eternal Flowers. La historia de cómo un viaje a Tailandia y una pasión por las orquídeas dieron origen a joyas botánicas que inmortalizan la belleza de las flores.',
    },
  },

  it: {
    hero: {
      label: 'L\'Artigiana',
      title: 'Conoscere Marina',
      subtitle: 'La mano e il cuore dietro ogni creazione Eternal Flowers.',
    },
    section2: {
      label: 'Radici',
      title: 'Tra la terra, la scienza e la cura della vita',
      paragraphs: [
        'Marina è nata a San Paolo, in Brasile, da genitori portoghesi. Si è trasferita in Portogallo all\'età di quattro anni.',
        'Quando aveva circa quattro anni e viveva ancora a San Paolo, Marina aveva un melograno come sua migliore amica. Questo ricordo d\'infanzia rivela un legame con la natura che l\'avrebbe accompagnata per tutta la vita.',
        'Più tardi, si è laureata in Ingegneria Agronomica e ha lavorato come ingegnere. La sua formazione scientifica ha approfondito la sua comprensione della natura e degli esseri viventi.',
        'Ma il suo percorso professionale ha preso una nuova direzione — quella della cura delle persone.',
      ],
    },
    section3: {
      label: 'Cura',
      title: 'Il cammino verso la medicina naturale',
      paragraphs: [
        'Marina ha scoperto la naturopatia e la Chiropratica Orientale, legata alla Medicina Cinese. In questo percorso, la natura gioca un ruolo importante: vengono valorizzati approcci e metodi non invasivi, che promuovono l\'equilibrio e il benessere dell\'organismo.',
        'Ha imparato a vedere la persona come un tutto e a integrare principi naturali nella cura.',
        'Questo sguardo attento, questa pazienza nell\'ascoltare e osservare — sono le stesse qualità che oggi applica nella creazione di ogni gioiello botanico.',
      ],
    },
    section4: {
      label: 'Mar&Natur',
      title: 'Dove la cura incontra la natura',
      paragraphs: [
        'Marina ha fondato Mar&Natur a Vila de Prado, Braga. Lavora in questo campo da circa 16 anni, avendo studiato in Portogallo e all\'estero. È diventata una terapeuta conosciuta nella regione di Braga.',
        'In Mar&Natur, Marina applica la stessa dedizione, vicinanza e attenzione che definiscono il suo modo di stare con le persone. La natura, i metodi non invasivi e l\'equilibrio dell\'organismo hanno un ruolo importante nel suo percorso professionale.',
        'Marina divide la sua vita tra Braga e Lisbona.',
      ],
    },
    section5: {
      label: 'La Scoperta',
      title: 'Da un viaggio in Thailandia è nata Eternal Flowers',
      paragraphs: [
        'La sua passione per le orchidee è nata durante un viaggio in Thailandia, quando ha visitato un orchidario. È stato in quel contatto con la diversità e la bellezza di questi fiori che è iniziato un legame che avrebbe segnato il suo percorso artigianale.',
        'Più tardi, ha iniziato a sperimentare la disidratazione dei fiori e la loro conservazione nella resina epossidica. Ha frequentato corsi e perfezionato la tecnica.',
        'Eternal Flowers è nata e continua a crescere.',
      ],
    },
    section6: {
      label: 'Processo',
      title: 'Apprendimento e perfezionamento artigianale',
      paragraphs: [
        'È stata invitata a esporre grazie alla qualità dei suoi pezzi e al lavoro artigianale. Ogni pezzo che crea è il risultato di studio, pratica e perfezionamento costante.',
        'Attraverso corsi, studio e pratica, Marina ha perfezionato il processo di disidratazione dei fiori e la loro conservazione nella resina epossidica.',
        'Ogni pezzo riflette questo percorso di apprendimento, sperimentazione e perfezionamento.',
      ],
    },
    section7: {
      label: 'Esposizioni',
      title: 'Esposizioni in Portogallo e Spagna',
      paragraphs: [
        'Eternal Flowers ha presenziato a esposizioni in Portogallo e Spagna.',
        'In Spagna, ha partecipato a esposizioni a Estepona e Cordova. In Portogallo, è stata presente a Lisbona, incluso lo Zoo di Lisbona, a Coimbra e in altre località.',
        'Ogni partecipazione rappresenta una nuova tappa nella crescita del marchio e un\'opportunità di presentare il suo lavoro a persone interessate alla natura, all\'artigianato e a pezzi con significato.',
      ],
    },
    section8: {
      label: 'Essenza',
      title: 'La persona dietro ogni pezzo',
      paragraphs: [
        'In Eternal Flowers, ogni pezzo nasce per immortalare la bellezza di un fiore.',
        'Non vende semplicemente gioielli. Aiuta le persone a conservare ricordi che possono portare al petto, sulle dita, sulle orecchie — tutti i giorni.',
        'Un fiore è effimero. Un pezzo Eternal Flowers cerca di preservare la sua bellezza e il ricordo che porta con sé.',
        'Marina è amica, divertente, disponibile e dedicata. È esigente con la qualità e non le piace lasciare clienti o pazienti insoddisfatti.',
        'Ogni pezzo che crea è un pezzo di sé che resta con chi lo sceglie.',
      ],
    },
    quote: {
      text: 'Non vendo semplicemente gioielli. Aiuto le persone a conservare ricordi che possono portare al petto tutti i giorni.',
      author: 'Marina',
    },
    cta: {
      heading: 'Vuoi creare un tuo pezzo?',
      text: 'Scoprire i pezzi',
      link: '/catalogo',
    },
    meta: {
      title: 'Conoscere Marina',
      description:
        'Conosci Marina, ingegnere agronomica, naturopata e artigiana dietro Eternal Flowers. La storia di come un viaggio in Thailandia e una passione per le orchidee hanno dato origine a gioielli botanici che immortalano la bellezza dei fiori.',
    },
  },

  de: {
    hero: {
      label: 'Die Kunsthandwerkerin',
      title: 'Marina kennenlernen',
      subtitle: 'Die Hand und das Herz hinter jedem Eternal-Flowers-Stück.',
    },
    section2: {
      label: 'Wurzeln',
      title: 'Zwischen Erde, Wissenschaft und der Fürsorge für das Leben',
      paragraphs: [
        'Marina wurde in São Paulo, Brasilien, als Tochter portugiesischer Eltern geboren. Im Alter von vier Jahren zog sie nach Portugal.',
        'Als sie etwa vier Jahre alt war und noch in São Paulo lebte, hatte Marina einen Granatapfelbaum als ihre beste Freundin. Diese Kindheitserinnerung offenbart eine Verbindung zur Natur, die sie ihr ganzes Leben lang begleiten sollte.',
        'Später schloss sie ein Studium der Agrarwissenschaften ab und arbeitete als Ingenieurin. Ihre wissenschaftliche Ausbildung vertiefte ihr Verständnis für die Natur und die Lebewesen.',
        'Doch ihr beruflicher Weg nahm eine neue Richtung — die der Fürsorge für die Menschen.',
      ],
    },
    section3: {
      label: 'Fürsorge',
      title: 'Der Weg zur Naturmedizin',
      paragraphs: [
        'Marina entdeckte die Naturheilkunde und die Orientalische Chiropraktik, verbunden mit der Chinesischen Medizin. Auf diesem Weg spielt die Natur eine wichtige Rolle: nicht-invasive Ansätze und Methoden werden geschätzt, die Gleichgewicht und Wohlbefinden fördern.',
        'Sie lernte, den Menschen als Ganzes zu sehen und natürliche Prinzipien in die Fürsorge zu integrieren.',
        'Dieser aufmerksame Blick, diese Geduld zuzuhören und zu beobachten — es sind dieselben Qualitäten, die sie heute in die Kreation jedes botanischen Schmuckstücks einfliessen lässt.',
      ],
    },
    section4: {
      label: 'Mar&Natur',
      title: 'Wo Fürsorge auf Natur trifft',
      paragraphs: [
        'Marina gründete Mar&Natur in Vila de Prado, Braga. Sie arbeitet seit etwa 16 Jahren in diesem Bereich und hat Ausbildungen in Portugal und im Ausland absolviert. Sie wurde zu einer bekannten Therapeutin in der Region Braga.',
        'In Mar&Natur bringt Marina dieselbe Hingabe, Nähe und Aufmerksamkeit ein, die ihre Art, mit Menschen umzugehen, auszeichnen. Die Natur, nicht-invasive Methoden und das Gleichgewicht des Organismus spielen eine wichtige Rolle in ihrem beruflichen Werdegang.',
        'Marina teilt ihr Leben zwischen Braga und Lissabon auf.',
      ],
    },
    section5: {
      label: 'Die Entdeckung',
      title: 'Aus einer Thailand-Reise entstand Eternal Flowers',
      paragraphs: [
        'Ihre Leidenschaft für Orchideen entstand während einer Reise nach Thailand, als sie einen Orchideengarten besuchte. In dieser Begegnung mit der Vielfalt und Schönheit dieser Blumen begann eine Verbindung, die ihren handwerklichen Weg prägen sollte.',
        'Später begann sie, mit dem Trocknen von Blumen und ihrer Konservierung in Epoxidharz zu experimentieren. Sie besuchte Kurse und verfeinerte die Technik.',
        'Eternal Flowers entstand und wächst weiter.',
      ],
    },
    section6: {
      label: 'Prozess',
      title: 'Lernen und handwerkliche Verfeinerung',
      paragraphs: [
        'Sie wurde eingeladen, auszustellen, aufgrund der Qualität ihrer Stücke und ihrer handwerklichen Arbeit. Jedes Stück, das sie erschafft, ist das Ergebnis von Studium, Praxis und ständiger Verfeinerung.',
        'Durch Kurse, Studium und Praxis hat Marina den Prozess des Trocknens von Blumen und ihrer Konservierung in Epoxidharz verfeinert.',
        'Jedes Stück spiegelt diesen Weg des Lernens, Experimentierens und der Verfeinerung wider.',
      ],
    },
    section7: {
      label: 'Ausstellungen',
      title: 'Ausstellungen in Portugal und Spanien',
      paragraphs: [
        'Eternal Flowers war auf Ausstellungen in Portugal und Spanien vertreten.',
        'In Spanien nahm sie an Ausstellungen in Estepona und Córdoba teil. In Portugal war sie in Lissabon, einschliesslich des Zoologischen Gartens, in Coimbra und an anderen Orten präsent.',
        'Jede Teilnahme stellt ein neues Kapitel im Wachstum der Marke dar und eine Gelegenheit, ihre Arbeit Menschen vorzustellen, die sich für Natur, Handwerk und bedeutungsvolle Stücke interessieren.',
      ],
    },
    section8: {
      label: 'Essenz',
      title: 'Die Person hinter jedem Stück',
      paragraphs: [
        'Bei Eternal Flowers entsteht jedes Stück, um die Schönheit einer Blume unsterblich zu machen.',
        'Sie verkauft nicht einfach Schmuck. Sie hilft Menschen, Erinnerungen zu bewahren, die sie an der Brust, an den Fingern, an den Ohren tragen können — jeden Tag.',
        'Eine Blume ist vergänglich. Ein Eternal-Flowers-Stück versucht, ihre Schönheit und die damit verbundene Erinnerung zu bewahren.',
        'Marina ist freundlich, lustig, hilfsbereit und hingebungsvoll. Sie legt Wert auf Qualität und mag es nicht, Kunden oder Patienten unzufrieden zu lassen.',
        'Jedes Stück, das sie erschafft, ist ein Teil von ihr, der bei dem bleibt, der es wählt.',
      ],
    },
    quote: {
      text: 'Ich verkaufe nicht einfach Schmuck. Ich helfe Menschen, Erinnerungen zu bewahren, die sie jeden Tag an der Brust tragen können.',
      author: 'Marina',
    },
    cta: {
      heading: 'Möchtest du dein eigenes Stück kreieren?',
      text: 'Die Stücke entdecken',
      link: '/katalog',
    },
    meta: {
      title: 'Marina kennenlernen',
      description:
        'Lerne Marina kennen, Agrarwissenschaftlerin, Naturheilpraktikerin und Kunsthandwerkerin hinter Eternal Flowers. Die Geschichte, wie eine Reise nach Thailand und eine Leidenschaft für Orchideen zu einzigartigem botanischem Schmuck führten, der die Schönheit der Blumen unsterblich macht.',
    },
  },
}