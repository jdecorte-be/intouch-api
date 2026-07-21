import { Test, TestingModule } from "@nestjs/testing";

import { AppController } from "./app.controller";

describe("AppController", () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe("root", () => {
    it("reports the service as ok", () => {
      expect(appController.root()).toEqual({ service: "retalk-api", status: "ok" });
    });
  });
});
