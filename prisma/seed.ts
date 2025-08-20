import { type BookPart, PrismaClient, Visibility } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

function getRandomPicsumUrl(): string {
  const id = Math.floor(Math.random() * 1000);
  return `https://picsum.photos/id/${id}/640/480`;
}

function getMockPdfUrl(): string {
  return `/storage/notizen.pdf`;
}
function getRandomModuleName(): string {
    const firstWord = faker.word.adjective(5);
    const secondWord = faker.word.noun(6);
    const number = faker.number.int({ min: 1000, max: 9999 }).toString().padStart(4, '0');
    const combinedWord = `${firstWord}_${secondWord}_${number}`
    return combinedWord.toLocaleLowerCase();
  }

async function seed() {
  // Define module types
  const moduleTypes = [
    { name: 'umschlag', minPages: 4, maxPages: 4 },
    { name: 'bindung', minPages: 2, maxPages: 8 },
    { name: 'wochenplaner', minPages: 4, maxPages: 92 },
    { name: 'sonstige', minPages: 1, maxPages: -1 },
    { name: 'notizbuch', minPages: 50, maxPages: 200 },
    { name: 'kalender', minPages: 12, maxPages: 24 },
    { name: 'tagebuch', minPages: 100, maxPages: 365 },
    { name: 'planer', minPages: 10, maxPages: 50 },
    { name: 'skizzenbuch', minPages: 20, maxPages: 100 },
    { name: 'fotobuch', minPages: 10, maxPages: 80 },
  ];

  function handleBookPart(type: string): BookPart {
    switch (type.toLocaleLowerCase()) {
      case "umschlag":
        return "COVER"
      case "wochenplaner":
        return "PLANNER"
      case "bindung":
        return "BINDING"
      default:
        return "DEFAULT"
    }
  }


  for (const type of moduleTypes) {
    const existingType = await prisma.moduleType.findFirst({
      where:{
        name:type.name.toLocaleLowerCase()
      }
    })

    if(existingType) {
      console.log("type exists")
    }else{
      await prisma.moduleType.create({
          data:{
         
            name: type.name.toLocaleLowerCase(),
            minPages: type.minPages,
            maxPages: type.maxPages,
          }
      })
    }

  }

  // Fetch created module types
  const createdTypes = await prisma.moduleType.findMany();
  const themes = ['modern', 'classic', 'minimal', 'vintage', 'colorful', null];
  const defaultType = createdTypes.find(t => t.name === "sonstige");

  // Generate modules
  for (let i = 0; i < 1000; i++) {
    const randomType = faker.helpers.arrayElement(createdTypes) ?? defaultType;
    const randomTheme = faker.helpers.arrayElement(themes);
    const moduleName = getRandomModuleName();
    const vis = ["PUBLIC", "SHARED", "PRIVATE"]
    const randomNumber = Math.floor(Math.random() * 3)
    await prisma.module.create({
      data: {
        visible: vis[randomNumber] as Visibility,
        name: moduleName,
        part: handleBookPart(randomType.name),
        typeId: randomType?.id ?? defaultType!.id,
        theme: randomTheme,
        createdAt: faker.date.past(),
        updatedAt: faker.date.recent(),
        files: {
          create: [
            {
              name: "file_" + faker.system.fileName({ extensionCount: 0 }) + '.pdf',
              size: 1,
              src: getMockPdfUrl(),
              type: 'PDF',
            },
            {
              name: "thumb_" + faker.system.fileName({ extensionCount: 0 }) + '.png',
              size: 2,
              src: getRandomPicsumUrl(),
              type: 'IMAGE_PNG',
            }
          ]
        }
      },
    });
  }

  console.log('Seeded 1000 modules with associated files from mockup sources.');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    return void prisma.$disconnect();
  });