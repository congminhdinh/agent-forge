import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { ApiKeySetting } from './api-key-setting.entity';

const SUPPORTED_PROVIDERS = ['openai', 'anthropic'] as const;

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(ApiKeySetting)
    private readonly apiKeyRepository: Repository<ApiKeySetting>,
  ) {}

  async listApiKeys(user: User) {
    const records = await this.apiKeyRepository.find({
      where: { user: { id: user.id } },
      order: { provider: 'ASC' },
      relations: { user: true },
    });

    return SUPPORTED_PROVIDERS.map((provider) => {
      const record = records.find((candidate) => candidate.provider === provider);
      return {
        provider,
        configured: Boolean(record),
        updatedAt: record?.updatedAt ?? null,
      };
    });
  }

  async upsertApiKey(user: User, provider: string, apiKey: string) {
    let record = await this.apiKeyRepository.findOne({
      where: { user: { id: user.id }, provider },
      relations: { user: true },
    });

    if (!record) {
      record = this.apiKeyRepository.create({
        provider,
        user,
        encryptedValue: this.encrypt(apiKey),
      });
    } else {
      record.encryptedValue = this.encrypt(apiKey);
    }

    await this.apiKeyRepository.save(record);
    return this.listApiKeys(user);
  }

  async removeApiKey(user: User, provider: string) {
    const record = await this.apiKeyRepository.findOne({
      where: { user: { id: user.id }, provider },
      relations: { user: true },
    });

    if (!record) {
      throw new NotFoundException(`No ${provider} API key is configured.`);
    }

    await this.apiKeyRepository.remove(record);
    return this.listApiKeys(user);
  }

  async getProviderKey(userId: string, provider: string) {
    const record = await this.apiKeyRepository.findOne({
      where: { user: { id: userId }, provider },
      relations: { user: true },
    });

    if (!record) {
      return null;
    }

    return this.decrypt(record.encryptedValue);
  }

  private encrypt(value: string) {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.getSecret(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(
      '.',
    );
  }

  private decrypt(payload: string) {
    const [ivHex, tagHex, encryptedHex] = payload.split('.');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.getSecret(),
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }

  private getSecret() {
    return createHash('sha256')
      .update(
        process.env.APP_ENCRYPTION_SECRET ||
          process.env.JWT_SECRET ||
          'agent-forge-dev-secret',
      )
      .digest();
  }
}
