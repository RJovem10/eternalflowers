-- Seed com texto exacto dos manifestos (sourceHash match)

-- HOMEPAGE
INSERT INTO homepage (id, hero_primary_button_link, hero_secondary_button_link, instagram_handle, cta_button_link, footer_email, footer_phone, footer_instagram_url, footer_whatsapp_url,
  hero_hero_title, hero_hero_subtitle, hero_primary_button_text, hero_secondary_button_text,
  real_flowers_title, real_flowers_subtitle, story_title, story_text,
  international_title, international_subtitle, instagram_title, instagram_text,
  cta_title, cta_subtitle, cta_button_text, footer_brand_description)
VALUES (1,
  '/catalog', '/catalog', 'eternal.flowers.pt', '/catalog', 'loja@eternalflowers.pt', '+351****9999', 'https://instagram.com/eternal.flowers.pt', 'https://wa.me/351999999999',
  E'Eternizar um Momento,
Preservar uma Memória',
  E'Joias artesanais com flores verdadeiras preservadas. Cada peça é uma história que o tempo não apaga. Feitas à mão em Portugal, com a delicadeza de quem sabe que a beleza merece durar para sempre.',
  E'Descobrir Catálogo',
  E'Saber Mais',
  E'Flores Verdadeiras, Eternas',
  E'Cada peça começa com uma flor verdadeira, selecionada no auge da sua beleza.',
  E'Do Efêmero ao Eterno',
  E'A Eternal Flowers nasceu de um desejo simples: capturar a beleza das flores e torná-la eterna.

Num mundo onde tudo passa, acreditamos que há momentos que merecem durar. Cada peça que criamos começa com uma flor verdadeira — cultivada com carinho, colhida no seu auge e preservada artesanalmente.

O nosso atelier fica em Braga, Portugal. Aqui, a Marina e a sua equipa transformam flores frescas em jóias que desafiam o tempo. Não usamos moldes nem produção em série — cada peça é única, como a memória que representa.

Acreditamos que a natureza nos dá os materiais mais perfeitos. O nosso trabalho é apenas guiá-los, com respeito e delicadeza, para uma nova forma de existir.',
  E'Presença Internacional',
  E'De Braga para o mundo. As nossas peças já viajaram para mais de 15 países.',
  E'Siga-nos no Instagram',
  E'Acompanhe o dia-a-dia do atelier, os bastidores da criação e o carinho que colocamos em cada peça.',
  E'Pronta para Eternizar
uma Memória?',
  E'Cada peça é feita por encomenda. Se tem uma flor especial ou uma ideia em mente, vamos criar algo único para si.',
  E'Fale Connosco',
  E'Joias artesanais com flores verdadeiras preservadas. Feitas à mão em Portugal.'
)
ON CONFLICT (id) DO UPDATE SET
  hero_hero_title = EXCLUDED.hero_hero_title,
  hero_hero_subtitle = EXCLUDED.hero_hero_subtitle,
  hero_primary_button_text = EXCLUDED.hero_primary_button_text,
  hero_secondary_button_text = EXCLUDED.hero_secondary_button_text,
  real_flowers_title = EXCLUDED.real_flowers_title,
  real_flowers_subtitle = EXCLUDED.real_flowers_subtitle,
  story_title = EXCLUDED.story_title,
  story_text = EXCLUDED.story_text,
  international_title = EXCLUDED.international_title,
  international_subtitle = EXCLUDED.international_subtitle,
  instagram_title = EXCLUDED.instagram_title,
  instagram_text = EXCLUDED.instagram_text,
  cta_title = EXCLUDED.cta_title,
  cta_subtitle = EXCLUDED.cta_subtitle,
  cta_button_text = EXCLUDED.cta_button_text,
  footer_brand_description = EXCLUDED.footer_brand_description
;

-- CATEGORIES
INSERT INTO categories (slug, name, description) VALUES (E'brincos', E'Brincos', E'Brincos delicados com miniaturas botânicas.') ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (slug, name, description) VALUES (E'colares', E'Colares', E'Pendentes e colares com flores verdadeiras preservadas.') ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (slug, name, description) VALUES (E'molduras', E'Molduras', E'Molduras com flores verdadeiras.') ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (slug, name, description) VALUES (E'porta-chaves', E'Porta-chaves', E'Pequenas memórias que leva consigo.') ON CONFLICT (slug) DO NOTHING;
INSERT INTO categories (slug, name, description) VALUES (E'pulseiras', E'Pulseiras', E'Pulseiras artesanais com elementos florais.') ON CONFLICT (slug) DO NOTHING;

-- COLLECTIONS
INSERT INTO collections (slug, name, description, is_active) VALUES (E'casamentos', E'Casamentos', E'Para celebrar o amor.', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO collections (slug, name, description, is_active) VALUES (E'dia-da-mae', E'Dia da Mãe', E'Memórias que florescem para sempre.', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO collections (slug, name, description, is_active) VALUES (E'edicao-limitada', E'Edição Limitada', E'Criações únicas em tiragem limitada.', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO collections (slug, name, description, is_active) VALUES (E'memorias', E'Memórias', E'Um instante que o tempo não apaga.', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO collections (slug, name, description, is_active) VALUES (E'natureza', E'Natureza', E'Inspirado na beleza natural.', true) ON CONFLICT (slug) DO NOTHING;
INSERT INTO collections (slug, name, description, is_active) VALUES (E'primavera', E'Primavera', E'Peças frescas e vibrantes.', true) ON CONFLICT (slug) DO NOTHING;

-- FLOWERS
INSERT INTO flowers (id, name_pt, product_type, scientific_name, price, description_pt, sku, story, category_id) VALUES (1, E'Lágrima de Orvalho', 'permanente', E'Cattleya', 49.9, E'Um colar delicado como a primeira gota de orvalho da manhã.', E'flower-1', E'Inspirado nas manhãs frescas do Minho, quando o orvalho se acumula nas pétalas das orquídeas selvagens. Cada colar é composto por uma flor verdadeira, selecionada no auge da sua beleza, e preservada artesanalmente num processo que dura várias semanas.

A corrente é em aço banhado a ouro, com fecho de segurança. A peça central mede aproximadamente 3 cm de diâmetro.

Inclui certificado de autenticidade e embalagem premium.', 1) ON CONFLICT (id) DO UPDATE SET name_pt = EXCLUDED.name_pt, description_pt = EXCLUDED.description_pt, story = EXCLUDED.story;
INSERT INTO flowers (id, name_pt, product_type, scientific_name, price, description_pt, sku, story, category_id) VALUES (2, E'Sorriso da Manhã', 'permanente', E'Cattleya', 39.9, E'Brincos que capturam a doçura do primeiro sorriso do dia.', E'flower-2', E'Criados para celebrar os pequenos momentos de felicidade que iluminam o dia-a-dia. Cada par é único — as flores são selecionadas uma a uma pela Marina, garantindo que as cores e formas se complementam.

Hastes em prata esterlina 925 com banho de ouro. Fecho de borboleta para segurança e conforto.

Diâmetro de cada brinco: aproximadamente 1,5 cm.', 2) ON CONFLICT (id) DO UPDATE SET name_pt = EXCLUDED.name_pt, description_pt = EXCLUDED.description_pt, story = EXCLUDED.story;
INSERT INTO flowers (id, name_pt, product_type, scientific_name, price, description_pt, sku, story, category_id) VALUES (3, E'Abraço Eterno', 'permanente', E'Sobrália', 59.9, E'Uma pulseira que envolve o pulso como um abraço que o tempo não desfaz.', E'flower-3', E'A Sobrália é carinhosamente chamada de "orquídea abraço" porque as suas pétalas se curvam para dentro, como braços que envolvem. Esta pulseira nasceu da vontade de traduzir esse gesto em joia.

Pulseira ajustável de 16 a 19 cm, em couro vegetal castanho, com flor encapsulada em resina UV. Fecho dourado com regulação.

Peça ideal para oferecer a alguém especial.', 3) ON CONFLICT (id) DO UPDATE SET name_pt = EXCLUDED.name_pt, description_pt = EXCLUDED.description_pt, story = EXCLUDED.story;
INSERT INTO flowers (id, name_pt, product_type, scientific_name, price, description_pt, sku, story, category_id) VALUES (4, E'Memória Doce', 'permanente', E'Cambria', 34.9, E'Um porta-chaves que guarda uma memória tão doce quanto o aroma da Cambria.', E'flower-4', E'A Cambria é conhecida pelas suas cores vibrantes e padrões únicos — cada flor é como uma pequena pintura da natureza. Seleccionamos os exemplares mais bonitos para criar estes porta-chaves.

Cápsula em resina de alta transparência, com 3 cm de diâmetro. Argola em metal banhado a ouro, resistente ao uso diário.

Um detalhe que transforma um objecto funcional numa pequena obra de arte.', 4) ON CONFLICT (id) DO UPDATE SET name_pt = EXCLUDED.name_pt, description_pt = EXCLUDED.description_pt, story = EXCLUDED.story;
INSERT INTO flowers (id, name_pt, product_type, scientific_name, price, description_pt, sku, story, category_id) VALUES (5, E'Janela para o Jardim', 'permanente', E'Phalaenopsis', 69.9, E'Uma moldura que mantém vivo um pedaço de jardim.', E'flower-5', E'Há quem diga que a Phalaenopsis se chama "flor borboleta" porque as suas pétalas lembram as asas de uma borboleta em voo. Esta moldura nasceu do desejo de capturar esse voo e torná-lo eterno.

Moldura em madeira de carvalho certificada, com 15x15 cm. Abertura de 8x8 cm para a flor preservada. Suporte de mesa ou parede.

Inclui pequena placa gravada com o nome da flor e a data de criação.', 5) ON CONFLICT (id) DO UPDATE SET name_pt = EXCLUDED.name_pt, description_pt = EXCLUDED.description_pt, story = EXCLUDED.story;
INSERT INTO flowers (id, name_pt, product_type, scientific_name, price, description_pt, sku, story, category_id) VALUES (6, E'Beijo de Luz', 'permanente', E'Laelia', 54.9, E'Um colar que captura um beijo de luz. Edição limitada e numerada.', E'flower-6', E'A Laelia purpurata é a flor-símbolo de Santa Catarina, Brasil — a terra-natal de Marina. Esta edição especial é uma homenagem às suas raízes e à luz tropical que inspirou a sua paixão pelas flores.

Pingente em vidro soprado artesanalmente, com a flor preservada no interior. Corrente em ouro 18k (banho), 45 cm. Número de série gravado.

Edição limitada a 30 peças numeradas.', 1) ON CONFLICT (id) DO UPDATE SET name_pt = EXCLUDED.name_pt, description_pt = EXCLUDED.description_pt, story = EXCLUDED.story;
INSERT INTO flowers (id, name_pt, product_type, scientific_name, price, description_pt, sku, story, category_id) VALUES (7, E'Dança das Pétalas', 'permanente', E'Vanda', 44.9, E'Brincos que dançam com o movimento. Design leve e arejado.', E'flower-7', E'A Vanda tricolor é uma das orquídeas mais elegantes — as suas pétalas parecem dançar quando a brisa passa. Estes brincos tentam recriar essa leveza.

Disponíveis apenas na Primavera e Verão, quando as Vandas estão em floração máxima. Cada flor é colhida no momento ideal.

Hastes em aço cirúrgico banhado a ouro rosa. Brincos de argola com 2,5 cm de diâmetro.', 2) ON CONFLICT (id) DO UPDATE SET name_pt = EXCLUDED.name_pt, description_pt = EXCLUDED.description_pt, story = EXCLUDED.story;
INSERT INTO flowers (id, name_pt, product_type, scientific_name, price, description_pt, sku, story, category_id) VALUES (8, E'Raiz do Amor', 'permanente', E'Paphiopedilum', 64.9, E'Uma pulseira que fala de raízes profundas. Amor que se fortalece com o tempo.', E'flower-8', E'O Paphiopedilum rothschildianum é uma das orquídeas mais raras do mundo — originária do Monte Kinabalu, no Bornéu. A sua forma única, que lembra um sapatinho, inspirou esta pulseira.

Pulseira em fio de couro entrançado, com fecho de prata. A flor encapsulada mede aproximadamente 2 cm. Peça certificada com documentação da origem botânica.

Edição limitada — cada pulseira é acompanhada de uma ilustração botânica da espécie.', 3) ON CONFLICT (id) DO UPDATE SET name_pt = EXCLUDED.name_pt, description_pt = EXCLUDED.description_pt, story = EXCLUDED.story;
INSERT INTO flowers (id, name_pt, product_type, scientific_name, price, description_pt, sku, story, category_id) VALUES (9, E'Sussurro da Natureza', 'permanente', E'Cattleya', 39.9, E'Um porta-chaves que sussurra histórias da floresta.', E'flower-9', E'Há qualquer coisa de mágico em encontrar uma flor silvestre durante uma caminhada. Este porta-chaves nasceu desses momentos — uma pausa no caminho, o cheiro a terra molhada, a descoberta de uma Sobrália escondida entre as folhas.

Cápsula em acrílico transparente, 2,5 cm. Argola dupla em metal prateado.

Peça sazonal — disponível apenas durante a floração da Sobrália, entre Maio e Julho.', 4) ON CONFLICT (id) DO UPDATE SET name_pt = EXCLUDED.name_pt, description_pt = EXCLUDED.description_pt, story = EXCLUDED.story;
INSERT INTO flowers (id, name_pt, product_type, scientific_name, price, description_pt, sku, story, category_id) VALUES (10, E'Eternidade em Flor', 'permanente', E'Cattleya', 79.9, E'Uma moldura que guarda a eternidade. Arco-íris de pétalas preservadas.', E'flower-10', E'Esta moldura é a peça mais ambiciosa do nosso atelier. Utilizamos pétalas de múltiplas variedades de Cambria para criar uma composição única — como um pequeno jardim eterno dentro de uma moldura.

Cada peça é composta por 5 a 7 flores diferentes, dispostas à mão pela Marina. O processo de preservação e montagem leva até 3 semanas.

Moldura em carvalho maciço, 20x20 cm, com passe-partout duplo. Inclui suporte de mesa e sistema de suspensão na parede.

Peça numerada e certificada — nunca mais de 10 unidades por série.', 5) ON CONFLICT (id) DO UPDATE SET name_pt = EXCLUDED.name_pt, description_pt = EXCLUDED.description_pt, story = EXCLUDED.story;

-- Verify
SELECT 'hp' AS t, COUNT(*) FROM homepage UNION ALL SELECT 'cat', COUNT(*) FROM categories UNION ALL SELECT 'col', COUNT(*) FROM collections UNION ALL SELECT 'fl', COUNT(*) FROM flowers ORDER BY t;