import { failure, type HttpFailure } from "@ador/http/outcome";
import { uploadOutcomes, type UploadOutcome } from "@ador/shared/uploads";

// A failure of an upload operation, built from the catalogue (`@ador/shared/uploads`): its status class and sentence are the catalogue's, and
// its reason travels in the error envelope so the page can choose its own words by it.
export function uploadFailure(name: UploadOutcome): HttpFailure {
  const { http, message } = uploadOutcomes[name];
  return failure(http, message, name);
}
