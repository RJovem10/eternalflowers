// Conteúdo editorial da página "Conhecer a Marina"
// Texto base aprovado — traduções necessitam de revisão humana antes da produção

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
      label: 'Percurso',
      title: 'Entre a ciência, o cuidado e a beleza da natureza',
      paragraphs: [
        'Sou a Marina, a mão por detrás da Eternal Flowers.',
        'Sempre amei flores. Desde pequena que passava horas no jardim dos meus avós, em Vila Verde, a observar as cores, os cheiros, a forma como cada pétala se abria ao sol.',
        'Anos mais tarde, formei-me em Medicina Natural e fundei a Mar&Natur, onde há mais de 16 anos ajudo pessoas a encontrar equilíbrio e bem-estar através da naturopatia e osteopatia.',
        'O meu percurso profissional ensinou-me a importância do cuidado — com o corpo, com a mente, com a natureza. E esse cuidado é o mesmo que coloco em cada peça que crio.',
        'Mas as flores nunca me deixaram.',
      ],
    },
    section3: {
      label: 'Formação',
      title: 'O caminho para a medicina natural',
      paragraphs: [
        'A minha formação em Medicina Natural começou com a vontade de compreender o corpo humano para além da superfície. A osteopatia, a naturopatia e a fitoterapia tornaram-se ferramentas para ajudar quem procurava uma abordagem mais integrada da saúde.',
        'Durante mais de 16 anos, a Mar&Natur foi o meu espaço de dedicação ao outro. Cada paciente que me procurou ensinou-me algo novo sobre resiliência, sobre o poder da natureza e sobre a beleza de cuidar.',
        'Este olhar atento, esta paciência para ouvir e observar — são as mesmas qualidades que hoje aplico na criação de cada joia botânica.',
      ],
    },
    section4: {
      label: 'Mar&Natur',
      title: 'A criação da Mar&Natur',
      paragraphs: [
        'A Mar&Natur nasceu da convicção de que a saúde e a natureza caminham juntas. Mais do que um consultório, sempre foi um espaço de acolhimento, onde cada pessoa é recebida com tempo e atenção.',
        'Foi nesta prática diária de cuidado que aprendi a verdadeira essência do que faço hoje: transformar matéria-prima em algo que toca as pessoas. Antes eram plantas medicinais e terapias manuais. Agora são flores eternizadas em resina.',
        'A Mar&Natur continua ativa — é a raiz que sustenta tudo o que crio. A Eternal Flowers é o ramo que floresceu desse tronco.',
      ],
    },
    section5: {
      label: 'A Origem',
      title: 'De uma paixão por orquídeas nasceu a Eternal Flowers',
      paragraphs: [
        'Foi numa feira de orquídeas que tudo começou.',
        'Olhei para uma orquídea e pensei: "É tão perfeita. E tão efémera. Porque é que isto não pode durar para sempre?"',
        'Comecei a experimentar. Sílica gel, resina, intermináveis tentativas e erros. Dias de frustração, semanas de silêncio, momentos de descoberta.',
        'Até que um dia — consegui.',
        'A primeira orquídea que eternizei está comigo até hoje. Não é perfeita — a técnica ainda era imatura — mas guarda a memória daquele momento em que percebi que não tinha descoberto apenas uma técnica. Tinha encontrado a minha forma de eternizar a beleza do mundo.',
      ],
    },
    section6: {
      label: 'Processo',
      title: 'Aprendizagem e aperfeiçoamento artesanal',
      paragraphs: [
        'Cada peça que crio é o resultado de anos de tentativas, de erros que me ensinaram mais do que os acertos. A desidratação de uma flor exige paciência: saber o momento exato em que a pétala está pronta, a humidade ideal, a temperatura certa.',
        'A resina é um material exigente. Aprendi a respeitá-la — a compreender como se comporta, como reage à temperatura, como envolve cada flor sem a danificar.',
        'Hoje, olho para cada peça e vejo o caminho que percorri. A primeira orquídea que eternizei, as experiências que falharam, as que superaram as minhas expectativas. Cada peça carrega esse percurso.',
        'Trabalho a partir do meu atelier em Braga, rodeada de orquídeas, frascos de sílica gel, pingentes por acabar e muito pó de resina. Cada peça que crio passa pelas minhas mãos: da colheita ao polimento final. Não há duas iguais. E é isso que as torna especiais.',
      ],
    },
    section7: {
      label: 'Exposições',
      title: 'Exposições em Portugal e Espanha',
      paragraphs: [
        'Todos os anos, levo a Eternal Flowers a feiras e exposições de orquídeas em Portugal e Espanha.',
        'Em Portugal, já marquei presença no Porto, Lisboa e Braga. Em Espanha, tenho apresentado o meu trabalho em exposições dedicadas ao universo das orquídeas.',
        'Cada exposição é uma oportunidade de mostrar ao vivo o brilho de uma pétala eternizada em resina, de explicar o processo a quem nunca viu nada igual, e de ouvir as histórias de quem se emociona com o que crio.',
        'Se quiseres conhecer as peças ao vivo, procura a Eternal Flowers na próxima exposição. Adoro conhecer quem usa o que crio.',
      ],
    },
    section8: {
      label: 'Essência',
      title: 'A pessoa por detrás de cada peça',
      paragraphs: [
        'Na Eternal Flowers, cada peça é um instante congelado no tempo.',
        'Não vendo simplesmente joias. Ajudo pessoas a guardar memórias que podem usar ao peito, nos dedos, nas orelhas — todos os dias.',
        'Uma flor vive dias. Uma joia Eternal Flowers vive para sempre. Mas a memória que ela carrega — essa dura a vida inteira.',
        'Sou a Marina. E cada peça que crio é um pedaço de mim que fica com quem a escolhe.',
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
      title: 'Conhecer a Marina — Eternal Flowers',
      description:
        'Conhece a Marina, a artesã e naturopata por detrás da Eternal Flowers. A história de como uma paixão por orquídeas deu origem a joias botânicas únicas.',
    },
  },

  en: {
    hero: {
      label: 'The Artisan',
      title: 'Meet Marina',
      subtitle: 'The hand and heart behind every Eternal Flowers piece.',
    },
    section2: {
      label: 'Background',
      title: 'Between science, care and the beauty of nature',
      paragraphs: [
        'I am Marina, the hands behind Eternal Flowers.',
        'I have always loved flowers. As a child, I spent hours in my grandparents\' garden in Vila Verde, watching the colours, the scents, the way each petal opened to the sun.',
        'Years later, I graduated in Natural Medicine and founded Mar&Natur, where for over 16 years I have helped people find balance and well-being through naturopathy and osteopathy.',
        'My professional journey taught me the importance of care — for the body, the mind, for nature. And that same care is what I put into every piece I create.',
        'But the flowers never left me.',
      ],
    },
    section3: {
      label: 'Education',
      title: 'The path to natural medicine',
      paragraphs: [
        'My training in Natural Medicine began with a desire to understand the human body beyond the surface. Osteopathy, naturopathy and phytotherapy became tools to help those seeking a more integrated approach to health.',
        'For over 16 years, Mar&Natur was my space of dedication to others. Each patient who came to me taught me something new about resilience, about the power of nature, and about the beauty of caring.',
        'This attentive gaze, this patience to listen and observe — these are the same qualities I now apply to creating each botanical jewel.',
      ],
    },
    section4: {
      label: 'Mar&Natur',
      title: 'The creation of Mar&Natur',
      paragraphs: [
        'Mar&Natur was born from the conviction that health and nature go hand in hand. More than a clinic, it has always been a space of welcome, where each person is received with time and attention.',
        'It was in this daily practice of care that I learned the true essence of what I do today: transforming raw material into something that touches people. Before, it was medicinal plants and manual therapies. Now, it is flowers preserved in resin.',
        'Mar&Natur remains active — it is the root that sustains everything I create. Eternal Flowers is the branch that bloomed from that trunk.',
      ],
    },
    section5: {
      label: 'The Origin',
      title: 'From a passion for orchids, Eternal Flowers was born',
      paragraphs: [
        'It was at an orchid fair that it all began.',
        'I looked at an orchid and thought: "It is so perfect. And so ephemeral. Why can\'t this last forever?"',
        'I started experimenting. Silica gel, resin, endless trial and error. Days of frustration, weeks of silence, moments of discovery.',
        'Until one day — I succeeded.',
        'The first orchid I preserved is still with me today. It is not perfect — the technique was still immature — but it holds the memory of that moment when I realised I had not just discovered a technique. I had found my way to eternalise the beauty of the world.',
      ],
    },
    section6: {
      label: 'Process',
      title: 'Learning and perfecting the craft',
      paragraphs: [
        'Each piece I create is the result of years of trial, of errors that taught me more than successes. Drying a flower requires patience: knowing the exact moment the petal is ready, the ideal humidity, the right temperature.',
        'Resin is a demanding material. I learned to respect it — to understand how it behaves, how it reacts to temperature, how it envelops each flower without damaging it.',
        'Today, I look at each piece and see the journey I have travelled. The first orchid I preserved, the experiments that failed, the ones that exceeded my expectations. Each piece carries that path.',
        'I work from my atelier in Braga, surrounded by orchids, jars of silica gel, unfinished pendants, and plenty of resin dust. Every piece I create passes through my hands: from harvest to final polish. No two are alike. And that is what makes them special.',
      ],
    },
    section7: {
      label: 'Exhibitions',
      title: 'Exhibitions in Portugal and Spain',
      paragraphs: [
        'Every year, I take Eternal Flowers to orchid fairs and exhibitions in Portugal and Spain.',
        'In Portugal, I have been present in Porto, Lisbon and Braga. In Spain, I have presented my work at exhibitions dedicated to the world of orchids.',
        'Each exhibition is an opportunity to show the glow of a petal preserved in resin up close, to explain the process to those who have never seen anything like it, and to hear the stories of those who are moved by what I create.',
        'If you would like to see the pieces in person, look for Eternal Flowers at the next exhibition. I love meeting those who wear what I create.',
      ],
    },
    section8: {
      label: 'Essence',
      title: 'The person behind every piece',
      paragraphs: [
        'At Eternal Flowers, each piece is a moment frozen in time.',
        'I do not simply sell jewellery. I help people keep memories they can wear at their chest, on their fingers, on their ears — every day.',
        'A flower lives for days. An Eternal Flowers jewel lives forever. But the memory it carries — that lasts a lifetime.',
        'I am Marina. And every piece I create is a piece of me that stays with whoever chooses it.',
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
      title: 'Meet Marina — Eternal Flowers',
      description:
        'Meet Marina, the artisan and naturopath behind Eternal Flowers. The story of how a passion for orchids gave rise to unique botanical jewellery.',
    },
  },

  es: {
    hero: {
      label: 'La Artesana',
      title: 'Conocer a Marina',
      subtitle: 'La mano y el corazón detrás de cada pieza Eternal Flowers.',
    },
    section2: {
      label: 'Trayectoria',
      title: 'Entre la ciencia, el cuidado y la belleza de la naturaleza',
      paragraphs: [
        'Soy Marina, la mano detrás de Eternal Flowers.',
        'Siempre amé las flores. Desde pequeña pasaba horas en el jardín de mis abuelos, en Vila Verde, observando los colores, los aromas, la forma en que cada pétalo se abría al sol.',
        'Años más tarde, me formé en Medicina Natural y fundé Mar&Natur, donde desde hace más de 16 años ayudo a personas a encontrar equilibrio y bienestar a través de la naturopatía y la osteopatía.',
        'Mi trayectoria profesional me enseñó la importancia del cuidado — con el cuerpo, con la mente, con la naturaleza. Y ese es el mismo cuidado que pongo en cada pieza que creo.',
        'Pero las flores nunca me dejaron.',
      ],
    },
    section3: {
      label: 'Formación',
      title: 'El camino hacia la medicina natural',
      paragraphs: [
        'Mi formación en Medicina Natural comenzó con el deseo de comprender el cuerpo humano más allá de la superficie. La osteopatía, la naturopatía y la fitoterapia se convirtieron en herramientas para ayudar a quienes buscaban un enfoque más integrado de la salud.',
        'Durante más de 16 años, Mar&Natur fue mi espacio de dedicación al otro. Cada paciente que me buscó me enseñó algo nuevo sobre resiliencia, sobre el poder de la naturaleza y sobre la belleza de cuidar.',
        'Esta mirada atenta, esta paciencia para escuchar y observar — son las mismas cualidades que hoy aplico en la creación de cada joya botánica.',
      ],
    },
    section4: {
      label: 'Mar&Natur',
      title: 'La creación de Mar&Natur',
      paragraphs: [
        'Mar&Natur nació de la convicción de que la salud y la naturaleza caminan juntas. Más que una consulta, siempre fue un espacio de acogida, donde cada persona es recibida con tiempo y atención.',
        'Fue en esta práctica diaria de cuidado donde aprendí la verdadera esencia de lo que hago hoy: transformar materia prima en algo que toca a las personas. Antes eran plantas medicinales y terapias manuales. Ahora son flores eternizadas en resina.',
        'Mar&Natur sigue activa — es la raíz que sostiene todo lo que creo. Eternal Flowers es la rama que floreció de ese tronco.',
      ],
    },
    section5: {
      label: 'El Origen',
      title: 'De una pasión por las orquídeas nació Eternal Flowers',
      paragraphs: [
        'Fue en una feria de orquídeas donde todo comenzó.',
        'Miré una orquídea y pensé: "Es tan perfecta. Y tan efímera. ¿Por qué esto no puede durar para siempre?"',
        'Empecé a experimentar. Sílica gel, resina, interminables intentos y errores. Días de frustración, semanas de silencio, momentos de descubrimiento.',
        'Hasta que un día — lo conseguí.',
        'La primera orquídea que eternicé sigue conmigo hoy. No es perfecta — la técnica aún era inmadura — pero guarda la memoria de aquel momento en que comprendí que no había descubierto solo una técnica. Había encontrado mi forma de eternizar la belleza del mundo.',
      ],
    },
    section6: {
      label: 'Proceso',
      title: 'Aprendizaje y perfeccionamiento artesanal',
      paragraphs: [
        'Cada pieza que creo es el resultado de años de intentos, de errores que me enseñaron más que los aciertos. La deshidratación de una flor exige paciencia: saber el momento exacto en que el pétalo está listo, la humedad ideal, la temperatura correcta.',
        'La resina es un material exigente. Aprendí a respetarla — a comprender cómo se comporta, cómo reacciona a la temperatura, cómo envuelve cada flor sin dañarla.',
        'Hoy, miro cada pieza y veo el camino que he recorrido. La primera orquídea que eternicé, los experimentos que fallaron, los que superaron mis expectativas. Cada pieza carga ese recorrido.',
        'Trabajo desde mi taller en Braga, rodeada de orquídeas, frascos de sílice gel, pendientes por terminar y mucho polvo de resina. Cada pieza que creo pasa por mis manos: de la cosecha al pulido final. No hay dos iguales. Y eso es lo que las hace especiales.',
      ],
    },
    section7: {
      label: 'Exposiciones',
      title: 'Exposiciones en Portugal y España',
      paragraphs: [
        'Cada año, llevo Eternal Flowers a ferias y exposiciones de orquídeas en Portugal y España.',
        'En Portugal, he estado presente en Oporto, Lisboa y Braga. En España, he presentado mi trabajo en exposiciones dedicadas al universo de las orquídeas.',
        'Cada exposición es una oportunidad para mostrar en vivo el brillo de un pétalo eternizado en resina, explicar el proceso a quien nunca ha visto nada igual, y escuchar las historias de quienes se emocionan con lo que creo.',
        'Si quieres conocer las piezas en vivo, busca Eternal Flowers en la próxima exposición. Me encanta conocer a quienes usan lo que creo.',
      ],
    },
    section8: {
      label: 'Esencia',
      title: 'La persona detrás de cada pieza',
      paragraphs: [
        'En Eternal Flowers, cada pieza es un instante congelado en el tiempo.',
        'No vendo simplemente joyas. Ayudo a personas a guardar recuerdos que pueden llevar al pecho, en los dedos, en las orejas — todos los días.',
        'Una flor vive días. Una joya Eternal Flowers vive para siempre. Pero el recuerdo que lleva — ese dura toda la vida.',
        'Soy Marina. Y cada pieza que creo es un pedazo de mí que se queda con quien la elige.',
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
      title: 'Conocer a Marina — Eternal Flowers',
      description:
        'Conoce a Marina, la artesana y naturópata detrás de Eternal Flowers. La historia de cómo una pasión por las orquídeas dio origen a joyas botánicas únicas.',
    },
  },

  it: {
    hero: {
      label: 'L\'Artigiana',
      title: 'Conoscere Marina',
      subtitle: 'La mano e il cuore dietro ogni creazione Eternal Flowers.',
    },
    section2: {
      label: 'Percorso',
      title: 'Tra scienza, cura e bellezza della natura',
      paragraphs: [
        'Sono Marina, la mano dietro Eternal Flowers.',
        'Ho sempre amato i fiori. Fin da piccola passavo ore nel giardino dei miei nonni, a Vila Verde, osservando i colori, i profumi, il modo in cui ogni petalo si apriva al sole.',
        'Anni dopo, mi sono laureata in Medicina Naturale e ho fondato Mar&Natur, dove da oltre 16 anni aiuto le persone a trovare equilibrio e benessere attraverso la naturopatia e l\'osteopatia.',
        'Il mio percorso professionale mi ha insegnato l\'importanza della cura — per il corpo, per la mente, per la natura. Ed è la stessa cura che metto in ogni pezzo che creo.',
        'Ma i fiori non mi hanno mai lasciata.',
      ],
    },
    section3: {
      label: 'Formazione',
      title: 'Il cammino verso la medicina naturale',
      paragraphs: [
        'La mia formazione in Medicina Naturale è iniziata con il desiderio di comprendere il corpo umano oltre la superficie. L\'osteopatia, la naturopatia e la fitoterapia sono diventate strumenti per aiutare chi cercava un approccio più integrato alla salute.',
        'Per oltre 16 anni, Mar&Natur è stato il mio spazio di dedizione agli altri. Ogni paziente che mi ha cercata mi ha insegnato qualcosa di nuovo sulla resilienza, sul potere della natura e sulla bellezza del prendersi cura.',
        'Questo sguardo attento, questa pazienza nell\'ascoltare e osservare — sono le stesse qualità che oggi applico nella creazione di ogni gioiello botanico.',
      ],
    },
    section4: {
      label: 'Mar&Natur',
      title: 'La creazione di Mar&Natur',
      paragraphs: [
        'Mar&Natur è nata dalla convinzione che salute e natura camminano insieme. Più che un ambulatorio, è sempre stato uno spazio di accoglienza, dove ogni persona è ricevuta con tempo e attenzione.',
        'È stato in questa pratica quotidiana di cura che ho imparato la vera essenza di ciò che faccio oggi: trasformare materia prima in qualcosa che tocca le persone. Prima erano piante medicinali e terapie manuali. Ora sono fiori eternizzati nella resina.',
        'Mar&Natur è ancora attiva — è la radice che sostiene tutto ciò che creo. Eternal Flowers è il ramo che è fiorito da quel tronco.',
      ],
    },
    section5: {
      label: 'L\'Origine',
      title: 'Da una passione per le orchidee è nata Eternal Flowers',
      paragraphs: [
        'È stato a una fiera di orchidee che tutto è iniziato.',
        'Ho guardato un\'orchidea e ho pensato: "È così perfetta. E così effimera. Perché non può durare per sempre?"',
        'Ho iniziato a sperimentare. Silica gel, resina, infiniti tentativi ed errori. Giorni di frustrazione, settimane di silenzio, momenti di scoperta.',
        'Fino a che un giorno — ci sono riuscita.',
        'La prima orchidea che ho eternizzato è ancora con me oggi. Non è perfetta — la tecnica era ancora immatura — ma conserva la memoria di quel momento in cui ho capito di non aver scoperto solo una tecnica. Avevo trovato il mio modo di eternizzare la bellezza del mondo.',
      ],
    },
    section6: {
      label: 'Processo',
      title: 'Apprendimento e perfezionamento artigianale',
      paragraphs: [
        'Ogni pezzo che creo è il risultato di anni di tentativi, di errori che mi hanno insegnato più dei successi. La disidratazione di un fiore richiede pazienza: sapere il momento esatto in cui il petalo è pronto, l\'umidità ideale, la temperatura giusta.',
        'La resina è un materiale esigente. Ho imparato a rispettarla — a capire come si comporta, come reagisce alla temperatura, come avvolge ogni fiore senza danneggiarlo.',
        'Oggi, guardo ogni pezzo e vedo il cammino che ho percorso. La prima orchidea che ho eternizzato, gli esperimenti falliti, quelli che hanno superato le mie aspettative. Ogni pezzo porta con sé quel percorso.',
        'Lavoro dal mio atelier a Braga, circondata da orchidee, barattoli di silica gel, pendenti da finire e tanta polvere di resina. Ogni pezzo che creo passa attraverso le mie mani: dalla raccolta alla lucidatura finale. Non ce ne sono due uguali. Ed è questo che li rende speciali.',
      ],
    },
    section7: {
      label: 'Esposizioni',
      title: 'Esposizioni in Portogallo e Spagna',
      paragraphs: [
        'Ogni anno, porto Eternal Flowers a fiere ed esposizioni di orchidee in Portogallo e Spagna.',
        'In Portogallo, sono stata presente a Porto, Lisbona e Braga. In Spagna, ho presentato il mio lavoro in esposizioni dedicate al mondo delle orchidee.',
        'Ogni esposizione è un\'opportunità per mostrare dal vivo lo splendore di un petalo eternizzato nella resina, spiegare il processo a chi non ha mai visto nulla di simile, e ascoltare le storie di chi si emoziona per ciò che creo.',
        'Se vuoi conoscere i pezzi dal vivo, cerca Eternal Flowers alla prossima esposizione. Amo conoscere chi indossa ciò che creo.',
      ],
    },
    section8: {
      label: 'Essenza',
      title: 'La persona dietro ogni pezzo',
      paragraphs: [
        'In Eternal Flowers, ogni pezzo è un istante congelato nel tempo.',
        'Non vendo semplicemente gioielli. Aiuto le persone a conservare ricordi che possono portare al petto, sulle dita, sulle orecchie — tutti i giorni.',
        'Un fiore vive giorni. Un gioiello Eternal Flowers vive per sempre. Ma il ricordo che porta — quello dura tutta la vita.',
        'Sono Marina. E ogni pezzo che creo è un pezzo di me che resta con chi lo sceglie.',
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
      title: 'Conoscere Marina — Eternal Flowers',
      description:
        'Conosci Marina, l\'artigiana e naturopata dietro Eternal Flowers. La storia di come una passione per le orchidee ha dato origine a gioielli botanici unici.',
    },
  },

  de: {
    hero: {
      label: 'Die Kunsthandwerkerin',
      title: 'Marina kennenlernen',
      subtitle: 'Die Hand und das Herz hinter jedem Eternal-Flowers-Stück.',
    },
    section2: {
      label: 'Werdegang',
      title: 'Zwischen Wissenschaft, Fürsorge und der Schönheit der Natur',
      paragraphs: [
        'Ich bin Marina, die Hand hinter Eternal Flowers.',
        'Ich habe schon immer Blumen geliebt. Schon als Kind verbrachte ich Stunden im Garten meiner Grosseltern in Vila Verde, beobachtete die Farben, die Düfte, die Art, wie sich jedes Blütenblatt der Sonne öffnete.',
        'Jahre später schloss ich mein Studium der Naturmedizin ab und gründete Mar&Natur, wo ich seit über 16 Jahren Menschen durch Naturheilkunde und Osteopathie helfe, Gleichgewicht und Wohlbefinden zu finden.',
        'Mein beruflicher Werdegang lehrte mich die Bedeutung der Fürsorge — für den Körper, den Geist, die Natur. Und dieselbe Fürsorge steckt in jedem Stück, das ich erschaffe.',
        'Aber die Blumen haben mich nie verlassen.',
      ],
    },
    section3: {
      label: 'Ausbildung',
      title: 'Der Weg zur Naturmedizin',
      paragraphs: [
        'Meine Ausbildung in Naturmedizin begann mit dem Wunsch, den menschlichen Körper über die Oberfläche hinaus zu verstehen. Osteopathie, Naturheilkunde und Phytotherapie wurden zu Werkzeugen, um Menschen zu helfen, die einen ganzheitlicheren Ansatz für ihre Gesundheit suchten.',
        'Über 16 Jahre lang war Mar&Natur mein Raum der Hingabe an andere. Jeder Patient, der zu mir kam, lehrte mich etwas Neues über Widerstandsfähigkeit, über die Kraft der Natur und über die Schönheit des Sorgens.',
        'Dieser aufmerksame Blick, diese Geduld zuzuhören und zu beobachten — es sind dieselben Qualitäten, die ich heute in die Kreation jedes botanischen Schmuckstücks einfliessen lasse.',
      ],
    },
    section4: {
      label: 'Mar&Natur',
      title: 'Die Gründung von Mar&Natur',
      paragraphs: [
        'Mar&Natur entstand aus der Überzeugung, dass Gesundheit und Natur Hand in Hand gehen. Mehr als eine Praxis war es immer ein Ort der Begegnung, an dem jeder Mensch mit Zeit und Aufmerksamkeit empfangen wird.',
        'In dieser täglichen Praxis der Fürsorge lernte ich die wahre Essenz dessen, was ich heute tue: Rohmaterial in etwas zu verwandeln, das Menschen berührt. Früher waren es Heilpflanzen und manuelle Therapien. Heute sind es in Harz verewigte Blumen.',
        'Mar&Natur ist weiterhin aktiv — es ist die Wurzel, die alles trägt, was ich erschaffe. Eternal Flowers ist der Zweig, der aus diesem Stamm erblüht ist.',
      ],
    },
    section5: {
      label: 'Der Ursprung',
      title: 'Aus einer Leidenschaft für Orchideen entstand Eternal Flowers',
      paragraphs: [
        'Es war auf einer Orchideenmesse, wo alles begann.',
        'Ich sah eine Orchidee und dachte: "Sie ist so perfekt. Und so vergänglich. Warum kann das nicht für immer halten?"',
        'Ich begann zu experimentieren. Silikagel, Harz, endlose Versuche und Irrtümer. Tage der Frustration, Wochen der Stille, Momente der Entdeckung.',
        'Bis eines Tages — ich schaffte es.',
        'Die erste Orchidee, die ich verewigte, ist noch heute bei mir. Sie ist nicht perfekt — die Technik war noch unreif — aber sie bewahrt die Erinnerung an den Moment, als ich erkannte, dass ich nicht nur eine Technik entdeckt hatte. Ich hatte meinen Weg gefunden, die Schönheit der Welt zu verewigen.',
      ],
    },
    section6: {
      label: 'Prozess',
      title: 'Lernen und handwerkliche Verfeinerung',
      paragraphs: [
        'Jedes Stück, das ich erschaffe, ist das Ergebnis jahrelanger Versuche, von Fehlern, die mich mehr lehrten als Erfolge. Das Trocknen einer Blume erfordert Geduld: den genauen Moment zu kennen, wann das Blütenblatt bereit ist, die ideale Luftfeuchtigkeit, die richtige Temperatur.',
        'Harz ist ein anspruchsvolles Material. Ich lernte, es zu respektieren — zu verstehen, wie es sich verhält, wie es auf Temperatur reagiert, wie es jede Blume umhüllt, ohne sie zu beschädigen.',
        'Heute sehe ich jedes Stück an und erkenne den Weg, den ich zurückgelegt habe. Die erste Orchidee, die ich verewigte, die Experimente, die scheiterten, diejenigen, die meine Erwartungen übertrafen. Jedes Stück trägt diesen Weg in sich.',
        'Ich arbeite in meinem Atelier in Braga, umgeben von Orchideen, Gläsern mit Silikagel, unfertigen Anhängern und viel Harzstaub. Jedes Stück, das ich erschaffe, geht durch meine Hände: von der Ernte bis zur Endpolitur. Keines gleicht dem anderen. Und das macht sie besonders.',
      ],
    },
    section7: {
      label: 'Ausstellungen',
      title: 'Ausstellungen in Portugal und Spanien',
      paragraphs: [
        'Jedes Jahr bringe ich Eternal Flowers zu Orchideenmessen und -ausstellungen in Portugal und Spanien.',
        'In Portugal war ich in Porto, Lissabon und Braga vertreten. In Spanien habe ich meine Arbeiten auf Ausstellungen präsentiert, die der Welt der Orchideen gewidmet sind.',
        'Jede Ausstellung ist eine Gelegenheit, den Glanz eines in Harz verewigten Blütenblatts hautnah zu zeigen, den Prozess denen zu erklären, die noch nie etwas Vergleichbares gesehen haben, und die Geschichten derer zu hören, die von dem berührt sind, was ich erschaffe.',
        'Wenn du die Stücke live sehen möchtest, suche Eternal Flowers auf der nächsten Ausstellung. Ich liebe es, die Menschen kennenzulernen, die tragen, was ich erschaffe.',
      ],
    },
    section8: {
      label: 'Essenz',
      title: 'Die Person hinter jedem Stück',
      paragraphs: [
        'Bei Eternal Flowers ist jedes Stück ein eingefrorener Augenblick.',
        'Ich verkaufe nicht einfach Schmuck. Ich helfe Menschen, Erinnerungen zu bewahren, die sie an der Brust, an den Fingern, an den Ohren tragen können — jeden Tag.',
        'Eine Blume lebt Tage. Ein Eternal-Flowers-Schmuckstück lebt für immer. Aber die Erinnerung, die es trägt — die hält ein Leben lang.',
        'Ich bin Marina. Und jedes Stück, das ich erschaffe, ist ein Stück von mir, das bei dem bleibt, der es wählt.',
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
      title: 'Marina kennenlernen — Eternal Flowers',
      description:
        'Lerne Marina kennen, die Kunsthandwerkerin und Naturheilpraktikerin hinter Eternal Flowers. Die Geschichte, wie eine Leidenschaft für Orchideen zu einzigartigem botanischem Schmuck führte.',
    },
  },
}